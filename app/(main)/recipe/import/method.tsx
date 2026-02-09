import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useImportStore } from '@/src/stores/importStore';

export default function MethodScreen() {
  const router = useRouter();
  const setMethod = useImportStore((state) => state.setMethod);
  const setImageUri = useImportStore((state) => state.setImageUri);
  const setPrepTimeMinutes = useImportStore((state) => state.setPrepTimeMinutes);
  const setCookTimeMinutes = useImportStore((state) => state.setCookTimeMinutes);

  const handleEnterManually = () => {
    setMethod('manual');
    setImageUri(null);
    setPrepTimeMinutes(0);
    setCookTimeMinutes(0);
    router.push('/(main)/recipe/import/manual-title');
  };

  const handleImportFromUrl = () => {
    setMethod('url');
    router.push('/(main)/recipe/import/url-import');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>How would you like to import?</Text>
          <Text style={styles.subtitle}>
            Add a recipe by link or enter it manually
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={handleEnterManually}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="create-outline" size={48} color={Colors.brand.sage} />
            </View>
            <Text style={styles.cardTitle}>Enter Manually</Text>
            <Text style={styles.cardDescription}>
              Type in your recipe details
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={handleImportFromUrl}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="globe-outline" size={48} color={Colors.brand.sage} />
            </View>
            <Text style={styles.cardTitle}>Import from URL</Text>
            <Text style={styles.cardDescription}>
              Paste a recipe link and we will pull in ingredients and steps
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
