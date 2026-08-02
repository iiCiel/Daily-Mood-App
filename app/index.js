import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done')
      .then((done) => setTarget(done ? '/(tabs)/life' : '/onboarding'));
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
