import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { loginUser, fetchUserProfile } from '../../services/authApi';
import { saveToken } from '../../utils/tokenStorage';

export default function LoginScreen({ navigation }) {
  const [Username, setUsername] = useState('');
  const [Password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const token = await loginUser({ Username, Password });
      await saveToken(token);
      const user = await fetchUserProfile(token);
      Alert.alert('Welcome', `Hello ${user.Firstname}!`);
      navigation.navigate('Map'); // or wherever your home screen is
    } catch (err) {
      Alert.alert('Login failed', err.response?.data?.error || 'Unknown error');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="Username" onChangeText={setUsername} />
      <TextInput placeholder="Password" secureTextEntry onChangeText={setPassword} />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
