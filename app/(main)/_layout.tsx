import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View } from 'react-native';
import Colors from '@/constants/Colors';

const chefHatIcon = require('@/assets/images/chefhat-icon.png');

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brand.sageDark,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          borderTopColor: Colors.light.border,
          backgroundColor: Colors.brand.cream,
          height: 74,
          paddingTop: 6,
          paddingBottom: 8,
        },
        headerStyle: {
          backgroundColor: Colors.brand.cream,
        },
        headerTintColor: Colors.light.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'ChefChat',
          headerTitle: 'ChefChat Assistant',
          tabBarLabel: '',
          tabBarIconStyle: {
            marginTop: -26,
          },
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.assistantButtonWrap,
                focused && styles.assistantButtonWrapFocused,
              ]}
            >
              <Image source={chefHatIcon} style={styles.assistantButtonIcon} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          href: null,
          title: 'Menu',
        }}
      />
      <Tabs.Screen
        name="dietary-preferences"
        options={{
          href: null,
          title: 'Dietary Preferences',
        }}
      />
      {/* Hide the recipe detail routes from the tab bar */}
      <Tabs.Screen
        name="recipe"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  assistantButtonWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.brand.sage,
    borderWidth: 4,
    borderColor: Colors.brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  assistantButtonWrapFocused: {
    backgroundColor: Colors.brand.sageDark,
  },
  assistantButtonIcon: {
    width: 30,
    height: 30,
    tintColor: Colors.brand.cream,
    resizeMode: 'contain',
  },
});
