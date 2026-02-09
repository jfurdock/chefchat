import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

export default function ImportLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.brand.cream },
        headerTintColor: Colors.light.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    />
  );
}
