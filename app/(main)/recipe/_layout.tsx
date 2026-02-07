import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

export default function RecipeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.brand.cream },
        headerTintColor: Colors.light.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    />
  );
}
