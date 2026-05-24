import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const INCIDENT_TYPES = [
  { id: 'DERRUMBE', icon: '⛰️', label: 'Derrumbe' },
  { id: 'CAMINO_DAÑADO', icon: '🚧', label: 'Camino Dañado' },
  { id: 'BLOQUEO', icon: '⛔', label: 'Bloqueo / Tráfico' }
];

export default function ReportScreen({ route, navigation }) {
  const { userLocation } = route.params;
  const { session } = useAuth();
  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri) => {
    const fileName = `report_${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Falta tipo', 'Por favor selecciona un tipo de incidente.');
      return;
    }
    setLoading(true);
    try {
      let photoUrl = null;
      if (photoUri) {
        photoUrl = await uploadPhoto(photoUri);
      }
      const { error } = await supabase.from('incident_reports').insert([{
        user_id: session.user.id,
        incident_type: selectedType,
        description,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        location: `POINT(${userLocation.longitude} ${userLocation.latitude})`,
        photo_url: photoUrl,
        status: 'ACTIVO',
      }]);
      if (error) throw error;
      Alert.alert('¡Gracias!', 'Tu reporte ha sido enviado y ayudará a otros conductores.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo enviar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reportar Incidente</Text>

      <Text style={styles.label}>¿Qué está pasando?</Text>
      <View style={styles.typesContainer}>
        {INCIDENT_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={[styles.typeButton, selectedType === type.id && styles.typeButtonSelected]}
            onPress={() => setSelectedType(type.id)}
          >
            <Text style={styles.typeIcon}>{type.icon}</Text>
            <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelSelected]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Descripción (Opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Ambos carriles bloqueados, lluvia fuerte..."
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Foto (Opcional)</Text>
      {photoUri ? (
        <View style={styles.photoPreviewContainer}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setPhotoUri(null)}>
            <Text style={styles.removePhotoText}>✕ Quitar foto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
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

      <View style={styles.locationInfo}>
        <Text style={styles.locationText}>
          📍 {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Enviar Reporte</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  content: { padding: 24, paddingTop: 50, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 10 },
  typesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  typeButton: {
    flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0',
    borderRadius: 14, padding: 14, alignItems: 'center', elevation: 1,
  },
  typeButtonSelected: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  typeIcon: { fontSize: 28, marginBottom: 6 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  typeLabelSelected: { color: '#0ea5e9' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1',
    borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a',
    textAlignVertical: 'top', marginBottom: 24, minHeight: 90,
  },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  photoBtn: {
    flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0',
    borderRadius: 14, padding: 16, alignItems: 'center', elevation: 1,
  },
  photoIcon: { fontSize: 32, marginBottom: 6 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  photoPreviewContainer: { marginBottom: 24 },
  photoPreview: { width: '100%', height: 200, borderRadius: 12, marginBottom: 10 },
  removePhotoBtn: { alignItems: 'center' },
  removePhotoText: { color: '#ef4444', fontWeight: '600' },
  locationInfo: {
    backgroundColor: '#e2e8f0', padding: 12, borderRadius: 10, marginBottom: 32,
  },
  locationText: { color: '#475569', fontSize: 13, textAlign: 'center' },
  actionButtons: { flexDirection: 'row', gap: 16 },
  cancelButton: { flex: 1, padding: 18, alignItems: 'center' },
  cancelText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: {
    flex: 2, backgroundColor: '#22c55e', padding: 18,
    borderRadius: 12, alignItems: 'center', elevation: 2,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
