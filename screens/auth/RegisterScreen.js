import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { registerUser } from '../../services/authApi';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    Username: '',
    Password: '',
    Firstname: '',
    Lastname: '',
  });

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleRegister = async () => {
    try {
      await registerUser(form);
      Alert.alert('Success', 'Account created. Please log in.');
      navigation.navigate('Login');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to register');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="Username" onChangeText={(v) => handleChange('Username', v)} />
      <TextInput placeholder="Password" secureTextEntry onChangeText={(v) => handleChange('Password', v)} />
      <TextInput placeholder="First Name" onChangeText={(v) => handleChange('Firstname', v)} />
      <TextInput placeholder="Last Name" onChangeText={(v) => handleChange('Lastname', v)} />
      <Button title="Register" onPress={handleRegister} />
    </View>
  );
}
