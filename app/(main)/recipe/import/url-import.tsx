import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useImportStore } from '@/src/stores/importStore';
import { scrapeRecipeFromUrl } from '@/src/services/importService';

export default function UrlImportScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const setMethod = useImportStore((state) => state.setMethod);
  const setTitle = useImportStore((state) => state.setTitle);
  const setDescription = useImportStore((state) => state.setDescription);
  const setImageUri = useImportStore((state) => state.setImageUri);
  const setPrepTimeMinutes = useImportStore((state) => state.setPrepTimeMinutes);
  const setCookTimeMinutes = useImportStore((state) => state.setCookTimeMinutes);
  const setIngredients = useImportStore((state) => state.setIngredients);
  const setSteps = useImportStore((state) => state.setSteps);

  const canSubmit = url.trim().length > 0 && !isScraping;

  const handleScrape = async () => {
    if (!url.trim()) return;

    setIsScraping(true);
    try {
      const scraped = await scrapeRecipeFromUrl(url);
      setMethod('url');
      setTitle(scraped.title);
      setDescription(scraped.description);
      setImageUri(scraped.imageUri);
      setPrepTimeMinutes(scraped.prepTimeMinutes);
      setCookTimeMinutes(scraped.cookTimeMinutes);
      setIngredients(scraped.ingredients);
      setSteps(scraped.steps);
      router.push('/(main)/recipe/import/review');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to scrape that URL right now.';
      Alert.alert('Import Failed', message);
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Import Recipe from URL</Text>
        <Text style={styles.subtitle}>
          Paste a recipe link. We will scrape the page, then you can review and edit before saving.
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons name="link-outline" size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="https://example.com/my-recipe"
            placeholderTextColor={Colors.light.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
            editable={!isScraping}
          />
        </View>

        <TouchableOpacity
          style={[styles.scrapeButton, !canSubmit && styles.scrapeButtonDisabled]}
          activeOpacity={0.75}
          onPress={handleScrape}
          disabled={!canSubmit}
        >
          {isScraping ? (
            <>
              <ActivityIndicator color={Colors.brand.cream} />
              <Text style={styles.scrapeButtonText}>Scraping Recipe...</Text>
            </>
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color={Colors.brand.cream} />
              <Text style={styles.scrapeButtonText}>Scrape and Review</Text>
            </>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    marginBottom: 24,
  },
  inputContainer: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    color: Colors.light.text,
    fontSize: 15,
  },
  scrapeButton: {
    marginTop: 18,
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scrapeButtonDisabled: {
    opacity: 0.45,
  },
  scrapeButtonText: {
    color: Colors.brand.cream,
    fontSize: 16,
    fontWeight: '700',
  },
});
