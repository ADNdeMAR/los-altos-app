import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const TYPE_CONFIG = {
  DERRUMBE:      { emoji: '⛰️', color: '#fef2f2', border: '#ef4444', label: 'Derrumbe' },
  CAMINO_DAÑADO: { emoji: '🚧', color: '#fff7ed', border: '#f97316', label: 'Camino Dañado' },
  BLOQUEO:       { emoji: '⛔', color: '#fefce8', border: '#eab308', label: 'Bloqueo' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export default function ReportListScreen({ navigation }) {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    const { data } = await supabase
      .from('incident_reports')
      .select('*')
      .eq('status', 'ACTIVO')
      .order('created_at', { ascending: false });
    if (data) setReports(data);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchReports(); };

  const handleDelete = async (id) => {
    Alert.alert('Eliminar Reporte', '¿Estás seguro de que deseas eliminar este reporte?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('incident_reports').delete().eq('id', id);
            if (error) throw error;
            fetchReports();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar el reporte.');
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0c3563" />
        <Text style={styles.loadingText}>Cargando reportes...</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.incident_type] || {
      emoji: '⚠️', color: '#f8fafc', border: '#94a3b8', label: item.incident_type
    };
    return (
      <View style={[styles.card, { backgroundColor: cfg.color, borderLeftColor: cfg.border }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardEmoji}>{cfg.emoji}</Text>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardType}>{cfg.label}</Text>
            <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.border }]}>
            <Text style={styles.statusText}>ACTIVO</Text>
          </View>
          {isAdmin && (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => navigation.navigate('Mapa', { screen: 'Report', params: { editReport: item } })} style={{ marginLeft: 8 }}>
                <Text style={{ fontSize: 18 }}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft: 16 }}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {item.description ? (
          <Text style={styles.cardDesc}>{item.description}</Text>
        ) : (
          <Text style={styles.cardDescEmpty}>Sin descripción adicional.</Text>
        )}
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.cardPhoto} />
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardCoords}>
            📍 {item.latitude ? item.latitude.toFixed(4) : '—'}, {item.longitude ? item.longitude.toFixed(4) : '—'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Reportes Activos</Text>
        <Text style={styles.headerSub}>{reports.length} incidente(s) reportado(s)</Text>
      </View>
      <FlatList
        data={reports}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0c3563']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyText}>No hay reportes activos</Text>
            <Text style={styles.emptySubText}>Las carreteras están libres por el momento</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#475569', fontSize: 16 },
  header: {
    backgroundColor: '#fff', paddingBottom: 16, paddingTop: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  list: { padding: 16, gap: 14 },
  card: {
    borderRadius: 14, borderLeftWidth: 5, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardEmoji: { fontSize: 28, marginRight: 12 },
  cardHeaderText: { flex: 1 },
  cardType: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  cardTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardDesc: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 10 },
  cardDescEmpty: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 },
  cardPhoto: { width: '100%', height: 180, borderRadius: 10, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  cardCoords: { fontSize: 12, color: '#94a3b8' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});
