import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View } from 'react-native';
import Colors from '@/constants/Colors';

const chefChatHatLogo = require('@/assets/images/chef_chat_hat_logo.png');

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
              <Image source={chefChatHatLogo} style={styles.assistantButtonIcon} />
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
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: Colors.brand.accent,
    borderWidth: 4,
    borderColor: Colors.brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.accentDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 10,
  },
  assistantButtonWrapFocused: {
    backgroundColor: Colors.brand.accentDark,
  },
  assistantButtonIcon: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
});
