import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(onboarding)/chat');
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: Colors.brand.cream }} />;
}
