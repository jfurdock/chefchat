import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';

export default function PhotoCaptureScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="image-outline" size={42} color={Colors.brand.sageDark} />
        </View>
        <Text style={styles.title}>Photo Import Removed</Text>
        <Text style={styles.subtitle}>
          Use URL import or manual entry to add a new recipe.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => router.replace('/(main)/recipe/import/url-import')}
        >
          <Ionicons name="link-outline" size={18} color={Colors.brand.cream} />
          <Text style={styles.primaryButtonText}>Import from URL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={() => router.replace('/(main)/recipe/import/manual-title')}
        >
          <Ionicons name="create-outline" size={18} color={Colors.brand.sageDark} />
          <Text style={styles.secondaryButtonText}>Enter Manually</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.card,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryButton: {
    minWidth: 220,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.brand.sageDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: Colors.brand.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minWidth: 220,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.light.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.brand.sageDark,
    fontSize: 15,
    fontWeight: '700',
  },
});
