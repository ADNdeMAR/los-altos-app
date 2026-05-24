import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Alert, TextInput, Modal, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function TouristScreen({ route }) {
  const { session, isAdmin } = useAuth();
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [photoUri, setPhotoUri] = useState(null);

  useEffect(() => { 
    fetchSpots(); 
    if (route?.params?.mapLocation) {
      setModalVisible(true);
    }
  }, [route?.params?.mapLocation]);

  const fetchSpots = async () => {
    const { data } = await supabase.from('tourist_spots').select('*').order('created_at', { ascending: false });
    if (data) setSpots(data);
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
    const fileName = `tourist_${Date.now()}.jpg`;
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
      const { error } = await supabase.from('tourist_spots').insert([{
        name: form.name,
        description: form.description,
        latitude: lat,
        longitude: lon,
        photo_url: photoUrl,
        created_by: session.user.id,
      }]);
      if (error) throw error;
      Alert.alert('✅', 'Punto turístico agregado.');
      setModalVisible(false);
      setForm({ name: '', description: '' });
      setPhotoUri(null);
      fetchSpots();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Eliminar Punto Turístico', '¿Estás seguro de que deseas eliminar este lugar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('tourist_spots').delete().eq('id', id);
            if (error) throw error;
            fetchSpots();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar el lugar.');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.cardPhoto} />
      ) : (
        <View style={styles.cardPhotoPlaceholder}>
          <Text style={styles.cardPhotoEmoji}>🏔️</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={styles.cardName}>{item.name}</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
        <Text style={styles.cardCoords}>
          📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🏔️ Puntos Turísticos</Text>
          <Text style={styles.headerSub}>{spots.length} lugar(es) registrado(s)</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Agregar</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏔️</Text>
              <Text style={styles.emptyText}>Sin puntos turísticos aún</Text>
            </View>
          }
        />
      )}

      {/* Modal agregar */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Agregar Punto Turístico</Text>
              <Text style={styles.modalLabel}>Nombre *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej. Mirador del Río Azul"
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
              />
              <Text style={styles.modalLabel}>Descripción</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 80 }]}
                placeholder="Descripción del lugar..."
                multiline
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
              />
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
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#d1fae5',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  addBtn: {
    backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 8,
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
    width: '100%', height: 120, backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center',
  },
  cardPhotoEmoji: { fontSize: 52 },
  cardBody: { padding: 16 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#475569', marginBottom: 8, lineHeight: 20 },
  cardCoords: { fontSize: 12, color: '#94a3b8' },
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
    flex: 1, borderWidth: 2, borderColor: '#d1fae5', borderRadius: 12,
    padding: 14, alignItems: 'center', backgroundColor: '#f0fdf4',
  },
  photoIcon: { fontSize: 28, marginBottom: 4 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
  previewPhoto: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },
  removePhoto: { color: '#ef4444', textAlign: 'center', fontWeight: '600', marginBottom: 16 },
  locationNote: { color: '#64748b', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#22c55e', padding: 16, borderRadius: 12,
    alignItems: 'center', marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelText: { textAlign: 'center', color: '#94a3b8', fontSize: 14 },
});
