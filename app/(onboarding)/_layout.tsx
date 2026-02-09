import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.brand.cream },
        animation: 'slide_from_right',
      }}
    />
  );
}
