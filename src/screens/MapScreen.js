import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text, ActivityIndicator,
  Alert, Modal, TextInput, ScrollView
} from 'react-native';
import MapView, { Marker, Polyline, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const TYPE_CONFIG = {
  DERRUMBE:      { emoji: '⛰️', color: '#ef4444' },
  CAMINO_DAÑADO: { emoji: '🚧', color: '#f97316' },
  BLOQUEO:       { emoji: '⛔', color: '#eab308' },
};

function clusterReports(reports) {
  const THRESHOLD = 0.005; // grados (~500m)
  const clusters = [];
  const used = new Set();

  reports.forEach((r, i) => {
    if (used.has(i)) return;
    const group = [r];
    used.add(i);
    reports.forEach((r2, j) => {
      if (used.has(j)) return;
      const dlat = Math.abs(r.latitude - r2.latitude);
      const dlng = Math.abs(r.longitude - r2.longitude);
      if (dlat < THRESHOLD && dlng < THRESHOLD) {
        group.push(r2);
        used.add(j);
      }
    });
    clusters.push(group);
  });
  return clusters;
}

export default function MapScreen({ navigation }) {
  const { session, isAdmin } = useAuth();
  const [location, setLocation] = useState(null);
  const [reports, setReports] = useState([]);
  const [touristSpots, setTouristSpots] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [altRoutes, setAltRoutes] = useState([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapCenter, setMapCenter] = useState(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Se necesita acceso a la ubicación.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const initialLoc = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setLocation(initialLoc);
      setMapCenter(initialLoc);
      setLoadingMap(false);
      fetchAll();
    })();
  }, []);

  const fetchAll = async () => {
    // Reportes
    const { data: rData } = await supabase
      .from('incident_reports')
      .select('*')
      .eq('status', 'ACTIVO');
    if (rData) setReports(rData);

    // Puntos turísticos
    const { data: tData } = await supabase.from('tourist_spots').select('*');
    if (tData) setTouristSpots(tData);

    // Talleres
    const { data: wData } = await supabase.from('workshops').select('*');
    if (wData) setWorkshops(wData);

    // Rutas alternas
    const { data: arData } = await supabase.from('alternate_routes').select('*');
    if (arData) setAltRoutes(arData);
  };

  const onSignOut = async () => await supabase.auth.signOut();

  if (loadingMap || !location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Obteniendo señal GPS...</Text>
      </View>
    );
  }

  const clusters = clusterReports(reports.filter(r => r.latitude != null && r.longitude != null));

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={location}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType="standard"
        onRegionChangeComplete={(region) => {
          if (isAdmin) setMapCenter(region);
        }}
      >
        {/* Rutas alternas */}
        {altRoutes.map(route => (
          <Polyline
            key={route.id}
            coordinates={route.coordinates}
            strokeColor={route.color || '#3b82f6'}
            strokeWidth={4}
          />
        ))}

        {/* Clusters de reportes */}
        {clusters.map((group, idx) => {
          const center = group[0];
          const isBig = group.length >= 5;
          const type = group[0].incident_type;
          const cfg = TYPE_CONFIG[type] || { emoji: '⚠️', color: '#6b7280' };
          return (
            <Marker
              key={`cluster-${idx}`}
              coordinate={{ latitude: center.latitude, longitude: center.longitude }}
            >
              <View style={[styles.markerContainer, isBig && styles.markerBig, { borderColor: cfg.color }]}>
                <Text style={isBig ? styles.markerEmojiBig : styles.markerEmoji}>{cfg.emoji}</Text>
                {isBig && <Text style={styles.clusterCount}>{group.length}</Text>}
              </View>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{type.replace('_', ' ')}</Text>
                  <Text style={styles.calloutSub}>{group.length} reporte(s)</Text>
                  <Text style={styles.calloutDesc}>{group[0].description || 'Sin descripción'}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Puntos turísticos */}
        {touristSpots.filter(spot => spot.latitude != null && spot.longitude != null).map(spot => (
          <Marker
            key={`t-${spot.id}`}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
          >
            <View style={[styles.markerContainer, { borderColor: '#22c55e' }]}>
              <Text style={styles.markerEmoji}>📸</Text>
            </View>
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{spot.name}</Text>
                <Text style={styles.calloutDesc}>{spot.description}</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Talleres */}
        {workshops.filter(w => w.latitude != null && w.longitude != null).map(w => (
          <Marker
            key={`w-${w.id}`}
            coordinate={{ latitude: w.latitude, longitude: w.longitude }}
          >
            <View style={[styles.markerContainer, { borderColor: '#0ea5e9' }]}>
              <Text style={styles.markerEmoji}>🔧</Text>
            </View>
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{w.name}</Text>
                <Text style={styles.calloutSub}>📞 {w.phone || 'Sin teléfono'}</Text>
                <Text style={styles.calloutDesc}>🕐 {w.hours || 'Sin horario'}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onSignOut}>
          <Text style={styles.headerBtnText}>Salir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={fetchAll}>
          <Text style={styles.headerBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* FABs Role Differentiated */}
      {!isAdmin ? (
        <TouchableOpacity
          style={[styles.fab, styles.fabUser]}
          onPress={() => navigation.navigate('Report', { userLocation: location })}
        >
          <Text style={styles.fabIcon}>🚨</Text>
          <Text style={styles.fabText}>REPORTAR</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.fab, styles.fabAdmin]}
          onPress={() => setShowAdminMenu(true)}
        >
          <Text style={styles.fabIcon}>➕</Text>
          <Text style={styles.fabText}>AGREGAR AQUÍ</Text>
        </TouchableOpacity>
      )}

      {/* Crosshair for Admin */}
      {isAdmin && (
        <View style={styles.crosshair} pointerEvents="none">
          <Text style={styles.crosshairIcon}>📍</Text>
        </View>
      )}

      {/* Admin Menu Modal */}
      <Modal visible={showAdminMenu} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowAdminMenu(false)}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitle}>¿Qué deseas agregar?</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowAdminMenu(false);
              navigation.navigate('Report', { userLocation: mapCenter || location });
            }}>
              <Text style={styles.menuItemEmoji}>⚠️</Text>
              <Text style={styles.menuItemText}>Reporte de Incidente</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowAdminMenu(false);
              navigation.navigate('Turismo', { mapLocation: mapCenter || location });
            }}>
              <Text style={styles.menuItemEmoji}>🏔️</Text>
              <Text style={styles.menuItemText}>Punto Turístico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowAdminMenu(false);
              navigation.navigate('Talleres', { mapLocation: mapCenter || location });
            }}>
              <Text style={styles.menuItemEmoji}>🔧</Text>
              <Text style={styles.menuItemText}>Taller Mecánico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowAdminMenu(false);
              navigation.navigate('Avisos');
            }}>
              <Text style={styles.menuItemEmoji}>📢</Text>
              <Text style={styles.menuItemText}>Aviso de Comunidad</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuCancel} onPress={() => setShowAdminMenu(false)}>
              <Text style={styles.menuCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF9F6' },
  loadingText: { marginTop: 12, color: '#475569', fontSize: 16 },
  map: { width: '100%', height: '100%' },
  header: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, elevation: 3,
  },
  headerBtnText: { color: '#0f172a', fontWeight: 'bold' },
  markerContainer: {
    backgroundColor: 'white', borderRadius: 20,
    width: 38, height: 38,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, elevation: 4,
  },
  markerBig: { width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  markerEmoji: { fontSize: 18, textAlign: 'center' },
  markerEmojiBig: { fontSize: 24, textAlign: 'center' },
  clusterCount: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', color: '#fff',
    fontSize: 11, fontWeight: 'bold',
    borderRadius: 10, paddingHorizontal: 5,
  },
  callout: { width: 180, padding: 8 },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  calloutSub: { fontSize: 12, color: '#475569', marginBottom: 2 },
  calloutDesc: { fontSize: 12, color: '#64748b' },
  fab: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 30,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3,
  },
  fabUser: { backgroundColor: '#ef4444' },
  fabAdmin: { backgroundColor: '#0ea5e9' },
  fabIcon: { fontSize: 24, marginRight: 8 },
  fabText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  crosshair: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -16, marginTop: -32, // Offset to point to the exact center
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2, elevation: 4
  },
  crosshairIcon: { fontSize: 32 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  menuBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, elevation: 5 },
  menuTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  menuItemEmoji: { fontSize: 24, marginRight: 12 },
  menuItemText: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  menuCancel: { marginTop: 12, padding: 12, alignItems: 'center' },
  menuCancelText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' }
});
