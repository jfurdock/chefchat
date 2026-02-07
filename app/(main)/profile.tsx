import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/hooks/useAuth';
import { signOut } from '@/src/services/authService';
import Colors from '@/constants/Colors';

export default function ProfileScreen() {
  const { user } = useAuth();

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.displayName || 'Chef'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Menu items */}
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="nutrition-outline" size={22} color={Colors.light.text} />
          <Text style={styles.menuText}>Dietary Preferences</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="timer-outline" size={22} color={Colors.light.text} />
          <Text style={styles.menuText}>Cooking History</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="mic-outline" size={22} color={Colors.light.text} />
          <Text style={styles.menuText}>Voice Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={22} color={Colors.light.text} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.brand.cream,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  menu: {
    backgroundColor: Colors.light.card,
    marginTop: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    color: Colors.light.text,
    flex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingVertical: 16,
    backgroundColor: Colors.light.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '600',
  },
});
