import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useImportStore } from '@/src/stores/importStore';

export default function ManualTitleScreen() {
  const router = useRouter();
  const title = useImportStore((state) => state.title);
  const description = useImportStore((state) => state.description);
  const setTitle = useImportStore((state) => state.setTitle);
  const setDescription = useImportStore((state) => state.setDescription);
  const setImageUri = useImportStore((state) => state.setImageUri);
  const setPrepTimeMinutes = useImportStore((state) => state.setPrepTimeMinutes);
  const setCookTimeMinutes = useImportStore((state) => state.setCookTimeMinutes);

  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description);

  const handleNext = () => {
    if (!localTitle.trim()) {
      Alert.alert('Required', 'Please enter a recipe title');
      return;
    }

    setTitle(localTitle);
    setDescription(localDescription);
    setImageUri(null);
    setPrepTimeMinutes(0);
    setCookTimeMinutes(0);

    router.push('/(main)/recipe/import/manual-ingredients');
  };

  const isNextDisabled = !localTitle.trim();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step 1 of 3</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Recipe Details</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Recipe Title*</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="e.g., Classic Chocolate Chip Cookies"
            placeholderTextColor={Colors.light.textSecondary}
            value={localTitle}
            onChangeText={setLocalTitle}
            maxLength={80}
          />
          <Text style={styles.charCount}>
            {localTitle.length}/80
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Add optional details about your recipe..."
            placeholderTextColor={Colors.light.textSecondary}
            value={localDescription}
            onChangeText={setLocalDescription}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {localDescription.length}/300
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.nextButton, isNextDisabled && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={isNextDisabled}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
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
  stepIndicator: {
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.sage,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
  },
  titleInput: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  descriptionInput: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 6,
    textAlign: 'right',
  },
  nextButton: {
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.light.textSecondary,
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
