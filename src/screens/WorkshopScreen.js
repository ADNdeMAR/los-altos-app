import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Alert, TextInput, Modal, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function WorkshopScreen({ route }) {
  const { session, isAdmin } = useAuth();
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', phone: '', hours: '' });
  const [photoUri, setPhotoUri] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation(loc.coords);
      } catch (_) {}
    })();
    fetchWorkshops();
    
    if (route?.params?.mapLocation) {
      setModalVisible(true);
    }
  }, [route?.params?.mapLocation]);

  const fetchWorkshops = async () => {
    const { data } = await supabase.from('workshops').select('*').order('created_at', { ascending: false });
    if (data) setWorkshops(data);
    setLoading(false);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uri) => {
    const fileName = `workshop_${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error } = await supabase.storage.from('photos').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'El nombre es requerido.'); return; }
    setSaving(true);
    try {
      let lat = null, lon = null;
      if (route?.params?.mapLocation) {
        lat = route.params.mapLocation.latitude;
        lon = route.params.mapLocation.longitude;
      } else {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }

      let photoUrl = null;
      if (photoUri) photoUrl = await uploadPhoto(photoUri);
      const { error } = await supabase.from('workshops').insert([{
        name: form.name,
        description: form.description,
        phone: form.phone,
        hours: form.hours,
        latitude: lat,
        longitude: lon,
        photo_url: photoUrl,
        created_by: session.user.id,
      }]);
      if (error) throw error;
      Alert.alert('✅', 'Taller agregado.');
      setModalVisible(false);
      setForm({ name: '', description: '', phone: '', hours: '' });
      setPhotoUri(null);
      fetchWorkshops();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Eliminar Taller', '¿Estás seguro de que deseas eliminar este taller?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('workshops').delete().eq('id', id);
            if (error) throw error;
            fetchWorkshops();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar el taller.');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => {
    const dist = userLocation
      ? getDistanceKm(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude)
      : null;

    return (
      <View style={styles.card}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.cardPhoto} />
        ) : (
          <View style={styles.cardPhotoPlaceholder}>
            <Text style={styles.cardPhotoEmoji}>🔧</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardName}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {dist !== null && (
                <View style={styles.distBadge}>
                  <Text style={styles.distText}>{dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`}</Text>
                </View>
              )}
              {isAdmin && (
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft: 8 }}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📞</Text>
              <Text style={styles.infoText}>{item.phone || 'Sin teléfono'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🕐</Text>
              <Text style={styles.infoText}>{item.hours || 'Sin horario'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🔧 Talleres Mecánicos</Text>
          <Text style={styles.headerSub}>{workshops.length} taller(es) registrado(s)</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Agregar</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={workshops}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔧</Text>
              <Text style={styles.emptyText}>Sin talleres registrados aún</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Agregar Taller</Text>

              {[
                { key: 'name', label: 'Nombre *', placeholder: 'Ej. Taller El Cuchumatán' },
                { key: 'phone', label: 'Teléfono', placeholder: '+502 5555-0000' },
                { key: 'hours', label: 'Horario', placeholder: 'Lun-Sáb 7am-6pm' },
                { key: 'description', label: 'Descripción', placeholder: 'Servicio general, llantas...' },
              ].map(field => (
                <View key={field.key}>
                  <Text style={styles.modalLabel}>{field.label}</Text>
                  <TextInput
                    style={[styles.modalInput, field.key === 'description' && { minHeight: 80 }]}
                    placeholder={field.placeholder}
                    multiline={field.key === 'description'}
                    value={form[field.key]}
                    onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                  />
                </View>
              ))}

              <Text style={styles.modalLabel}>Foto</Text>
              {photoUri ? (
                <View>
                  <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
                  <TouchableOpacity onPress={() => setPhotoUri(null)}>
                    <Text style={styles.removePhoto}>✕ Quitar foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                    <Text style={styles.photoIcon}>📷</Text>
                    <Text style={styles.photoBtnText}>Cámara</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery}>
                    <Text style={styles.photoIcon}>🖼️</Text>
                    <Text style={styles.photoBtnText}>Galería</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.locationNote}>
                {route?.params?.mapLocation ? '📍 Ubicación seleccionada en el mapa' : '📍 Se usará tu ubicación actual'}
              </Text>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e0f2fe',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  addBtn: {
    backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, elevation: 2,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  cardPhoto: { width: '100%', height: 200 },
  cardPhotoPlaceholder: {
    width: '100%', height: 100, backgroundColor: '#e0f2fe',
    justifyContent: 'center', alignItems: 'center',
  },
  cardPhotoEmoji: { fontSize: 48 },
  cardBody: { padding: 16 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 8 },
  distBadge: { backgroundColor: '#0ea5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  distText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cardDesc: { fontSize: 14, color: '#475569', marginBottom: 12, lineHeight: 20 },
  infoRow: { flexDirection: 'row', gap: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  infoIcon: { fontSize: 16 },
  infoText: { fontSize: 13, color: '#334155', flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#475569' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  modalInput: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 16, textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: {
    flex: 1, borderWidth: 2, borderColor: '#e0f2fe', borderRadius: 12,
    padding: 14, alignItems: 'center', backgroundColor: '#f0f9ff',
  },
  photoIcon: { fontSize: 28, marginBottom: 4 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#0ea5e9' },
  previewPhoto: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },
  removePhoto: { color: '#ef4444', textAlign: 'center', fontWeight: '600', marginBottom: 16 },
  locationNote: { color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#0ea5e9', padding: 16, borderRadius: 12,
    alignItems: 'center', marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelText: { textAlign: 'center', color: '#94a3b8', fontSize: 14 },
});
