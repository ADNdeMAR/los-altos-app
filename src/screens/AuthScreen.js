import React, { useState } from 'react';
import { Alert, StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error', error.message);
    if (!error && data) Alert.alert('Éxito', 'Revisa tu correo electrónico para confirmar la cuenta (o ignora si confirmación automática está activa).');
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Los Altos</Text>
      <Text style={styles.subtitle}>Navegación Comunitaria</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="Correo electrónico"
          placeholderTextColor="#7b7b8b"
          autoCapitalize={'none'}
        />
        <TextInput
          style={styles.input}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Contraseña"
          placeholderTextColor="#7b7b8b"
          autoCapitalize={'none'}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.buttonMain} disabled={loading} onPress={() => signInWithEmail()}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Iniciar Sesión</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.buttonSecondary} disabled={loading} onPress={() => signUpWithEmail()}>
          <Text style={styles.buttonTextSecondary}>Registrarse</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white para mejor lectura bajo la luz del sol
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 48,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#0f172a',
  },
  buttonContainer: {
    gap: 16,
  },
  buttonMain: {
    backgroundColor: '#0ea5e9', // Azul vibrante
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#0ea5e9',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonTextSecondary: {
    color: '#0ea5e9',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
