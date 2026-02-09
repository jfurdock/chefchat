import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useImportStore } from '@/src/stores/importStore';
import { saveImportedRecipe } from '@/src/services/importService';

export default function ReviewScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const title = useImportStore((state) => state.title);
  const description = useImportStore((state) => state.description);
  const imageUri = useImportStore((state) => state.imageUri);
  const prepTimeMinutes = useImportStore((state) => state.prepTimeMinutes);
  const cookTimeMinutes = useImportStore((state) => state.cookTimeMinutes);
  const ingredients = useImportStore((state) => state.ingredients);
  const steps = useImportStore((state) => state.steps);
  const method = useImportStore((state) => state.method);
  const cancelImport = useImportStore((state) => state.cancelImport);

  const handleEditTitle = () => {
    router.push('/(main)/recipe/import/manual-title');
  };

  const handleEditIngredients = () => {
    router.push('/(main)/recipe/import/manual-ingredients');
  };

  const handleEditInstructions = () => {
    router.push('/(main)/recipe/import/manual-instructions');
  };

  const handleSaveRecipe = async () => {
    if (!title || ingredients.length === 0 || steps.length === 0 || !method) {
      Alert.alert('Error', 'Please complete all recipe fields');
      return;
    }

    setSaving(true);

    try {
      await saveImportedRecipe({
        title,
        description,
        imageUri,
        prepTimeMinutes,
        cookTimeMinutes,
        ingredients,
        steps,
        importMethod: method,
      });

      cancelImport();

      Alert.alert('Success!', 'Your recipe has been saved', [
        {
          text: 'View My Recipes',
          onPress: () => {
            router.replace('/(main)/favorites');
          },
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save recipe';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const renderIngredient = ({ item, index }: { item: any; index: number }) => {
    const quantityStr = item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2);

    return (
      <View style={styles.ingredientRow}>
        <Text style={styles.bulletPoint}>•</Text>
        <View style={styles.ingredientContent}>
          <Text style={styles.ingredientText}>
            {quantityStr}
            {item.unit && ' ' + item.unit} {item.name}
          </Text>
        </View>
      </View>
    );
  };

  const renderStep = ({ item, index }: { item: any; index: number }) => {
    return (
      <View style={styles.stepRow}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <Text style={styles.stepText}>{item.instruction}</Text>
      </View>
    );
  };

  const getCategoryBadgeColor = (cat: string) => {
    const colorMap: Record<string, string> = {
      produce: '#4CAF50',
      protein: '#E53935',
      dairy: '#FFB300',
      pantry: '#8D6E63',
      spice: '#C2185B',
      other: Colors.light.textSecondary,
    };
    return colorMap[cat] || Colors.light.textSecondary;
  };

  return (
    <SafeAreaView style={styles.container}>
      {saving ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.sage} />
          <Text style={styles.processingText}>Saving recipe...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Review Recipe</Text>
            </View>

            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.recipeImage} />
            )}

            <View style={styles.recipeHeader}>
              <Text style={styles.recipeTitle}>{title}</Text>
              {description && (
                <Text style={styles.recipeDescription}>{description}</Text>
              )}
            </View>

            <View style={styles.editActionsRow}>
              <TouchableOpacity style={styles.editActionButton} onPress={handleEditTitle}>
                <Ionicons name="create-outline" size={16} color={Colors.brand.sageDark} />
                <Text style={styles.editActionText}>Edit Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editActionButton} onPress={handleEditIngredients}>
                <Ionicons name="list-outline" size={16} color={Colors.brand.sageDark} />
                <Text style={styles.editActionText}>Edit Ingredients</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editActionButton} onPress={handleEditInstructions}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.brand.sageDark} />
                <Text style={styles.editActionText}>Edit Steps</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-outline" size={24} color={Colors.brand.sage} />
                <Text style={styles.sectionTitle}>Ingredients</Text>
              </View>
              <FlatList
                scrollEnabled={false}
                data={ingredients}
                renderItem={renderIngredient}
                keyExtractor={(_, index) => `ingredient-${index}`}
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle-outline" size={24} color={Colors.brand.sage} />
                <Text style={styles.sectionTitle}>Instructions</Text>
              </View>
              <FlatList
                scrollEnabled={false}
                data={steps}
                renderItem={renderStep}
                keyExtractor={(_, index) => `step-${index}`}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveRecipe}
              disabled={saving}
            >
              <Ionicons name="checkmark" size={24} color="white" />
              <Text style={styles.saveButtonText}>Save Recipe</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
  },
  recipeImage: {
    width: '100%',
    height: 240,
    backgroundColor: Colors.light.border,
  },
  recipeHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  editActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  editActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.brand.sage,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand.sageDark,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 16,
    color: Colors.brand.sage,
    marginRight: 8,
    marginTop: 2,
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.sage,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  stepText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.brand.cream,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  saveButton: {
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});
