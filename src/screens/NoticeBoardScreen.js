import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Alert, TextInput, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function NoticeBoardScreen() {
  const { session, isAdmin } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: '', content: '' });
  const [photoUri, setPhotoUri] = useState(null);

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = async () => {
    const { data } = await supabase.from('cocode_notices').select('*').order('created_at', { ascending: false });
    if (data) setNotices(data);
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
    const fileName = `notice_${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error } = await supabase.storage.from('photos').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert('Error', 'El título es requerido.'); return; }
    if (!form.content.trim() && !photoUri && !editItem) { Alert.alert('Error', 'Debes añadir contenido o una foto.'); return; }

    setSaving(true);
    try {
      let photoUrl = editItem ? editItem.photo_url : null;
      if (photoUri && photoUri !== photoUrl) photoUrl = await uploadPhoto(photoUri);

      if (editItem) {
        const { error } = await supabase.from('cocode_notices').update({
          title: form.title,
          content: form.content,
          photo_url: photoUrl,
        }).eq('id', editItem.id);
        if (error) throw error;
        Alert.alert('✅', 'Aviso actualizado.');
      } else {
        const { error } = await supabase.from('cocode_notices').insert([{
          title: form.title,
          content: form.content,
          photo_url: photoUrl,
          author_id: session.user.id,
        }]);
        if (error) throw error;
        Alert.alert('✅', 'Aviso publicado exitosamente.');
      }
      setModalVisible(false);
      setEditItem(null);
      setForm({ title: '', content: '' });
      setPhotoUri(null);
      fetchNotices();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ title: item.title, content: item.content || '' });
    setPhotoUri(item.photo_url || null);
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: '', content: '' });
    setPhotoUri(null);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    Alert.alert('Eliminar Aviso', '¿Estás seguro de que deseas eliminar este aviso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('cocode_notices').delete().eq('id', id);
            if (error) throw error;
            fetchNotices();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar el aviso.');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => {
    const date = new Date(item.created_at).toLocaleDateString();
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDate}>{date}</Text>
          </View>
          {isAdmin && (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {item.content ? <Text style={styles.cardContent}>{item.content}</Text> : null}
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.cardPhoto} />
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📢 Avisos COCODES</Text>
          <Text style={styles.headerSub}>Tablero de anuncios a la comunidad</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Text style={styles.addBtnText}>+ Crear</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📢</Text>
              <Text style={styles.emptyText}>Sin avisos por el momento</Text>
            </View>
          }
        />
      )}

      {/* Modal agregar */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{editItem ? 'Editar Aviso' : 'Publicar Aviso'}</Text>
              <Text style={styles.modalLabel}>Título *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej. Reunión de vecinos"
                value={form.title}
                onChangeText={v => setForm(f => ({ ...f, title: v }))}
              />
              <Text style={styles.modalLabel}>Mensaje</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 80 }]}
                placeholder="Detalles del aviso..."
                multiline
                value={form.content}
                onChangeText={v => setForm(f => ({ ...f, content: v }))}
              />
              <Text style={styles.modalLabel}>Foto opcional</Text>
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
              
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editItem ? 'Guardar Cambios' : 'Publicar'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setModalVisible(false); setEditItem(null); }}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffbeb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingVertical: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#fde68a',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  addBtn: {
    backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, elevation: 2,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, padding: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 8 },
  cardDate: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  cardContent: { fontSize: 14, color: '#475569', marginBottom: 12, lineHeight: 20 },
  cardPhoto: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
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
    flex: 1, borderWidth: 2, borderColor: '#fde68a', borderRadius: 12,
    padding: 14, alignItems: 'center', backgroundColor: '#fffbeb',
  },
  photoIcon: { fontSize: 28, marginBottom: 4 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#d97706' },
  previewPhoto: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },
  removePhoto: { color: '#ef4444', textAlign: 'center', fontWeight: '600', marginBottom: 16 },
  saveBtn: {
    backgroundColor: '#f59e0b', padding: 16, borderRadius: 12,
    alignItems: 'center', marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelText: { textAlign: 'center', color: '#94a3b8', fontSize: 14 },
});
