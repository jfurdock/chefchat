import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipe, useFavorites } from '@/src/hooks/useRecipes';
import { useShoppingStore } from '@/src/stores/shoppingStore';
import Colors from '@/constants/Colors';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, loading, error } = useRecipe(id);
  const { toggleFavorite, isFavorite } = useFavorites();
  const { addRecipeToShoppingList, isRecipeOnShoppingList } = useShoppingStore();
  const router = useRouter();
  const [addedToList, setAddedToList] = useState(false);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Recipe' }} />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </>
    );
  }

  if (error || !recipe) {
    return (
      <>
        <Stack.Screen options={{ title: 'Recipe' }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Recipe not found</Text>
        </View>
      </>
    );
  }

  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const favorite = isFavorite(recipe.id);
  const chefHatIcon = require('../../../assets/images/chefhat-icon.png');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: recipe.title }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero image */}
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Ionicons name="restaurant" size={64} color={Colors.light.border} />
          </View>
        )}

        {/* Title & meta */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{recipe.title}</Text>
            <TouchableOpacity onPress={() => toggleFavorite(recipe.id)} hitSlop={8}>
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={26}
                color={favorite ? Colors.brand.sageDark : Colors.light.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.description}>{recipe.description}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Ionicons name="time-outline" size={20} color={Colors.brand.sageDark} />
              <Text style={styles.metaValue}>{totalTime} min</Text>
              <Text style={styles.metaLabel}>Total</Text>
            </View>
            <View style={styles.metaCard}>
              <Ionicons name="people-outline" size={20} color={Colors.brand.sageDark} />
              <Text style={styles.metaValue}>{recipe.servings}</Text>
              <Text style={styles.metaLabel}>Servings</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients.map((ingredient, idx) => (
            <View key={idx} style={styles.ingredientRow}>
              <View style={styles.bullet} />
              <Text style={styles.ingredientText}>
                <Text style={styles.ingredientQty}>
                  {ingredient.quantity} {ingredient.unit}
                </Text>{' '}
                {ingredient.name}
                {ingredient.preparation ? `, ${ingredient.preparation}` : ''}
                {ingredient.isOptional ? ' (optional)' : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.steps.map((step) => (
            <View key={step.number} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.number}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepText}>{step.instruction}</Text>
                {step.duration && (
                  <View style={styles.stepDuration}>
                    <Ionicons name="timer-outline" size={14} color={Colors.brand.sageDark} />
                    <Text style={styles.durationText}>
                      {step.duration >= 60
                        ? `${Math.floor(step.duration / 60)} min`
                        : `${step.duration} sec`}
                    </Text>
                  </View>
                )}
                {step.tips && (
                  <View style={styles.tipBox}>
                    <Ionicons name="bulb-outline" size={14} color={Colors.brand.sageDark} />
                    <Text style={styles.tipText}>{step.tips}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky action buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.cookButton}
          activeOpacity={0.8}
          onPress={() => router.push(`/(main)/recipe/cook/${recipe.id}`)}
        >
          <Image source={chefHatIcon} style={styles.cookButtonIcon} />
          <Text style={styles.cookButtonText}>Start Cooking</Text>
        </TouchableOpacity>
        {isRecipeOnShoppingList(recipe.id) || addedToList ? (
          <View style={[styles.shoppingButton, styles.shoppingButtonDisabled]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.brand.sageDark} />
            <Text style={styles.shoppingButtonTextDisabled}>On Shopping List</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.shoppingButton}
            activeOpacity={0.8}
            onPress={() => {
              addRecipeToShoppingList(recipe);
              setAddedToList(true);
              Alert.alert(
                'Added to Shopping List',
                `${recipe.title} ingredients have been added to your shopping list.`,
                [{ text: 'OK' }]
              );
            }}
          >
            <Ionicons name="cart-outline" size={20} color={Colors.brand.sageDark} />
            <Text style={styles.shoppingButtonText}>Add to Shopping List</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.brand.charcoal,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  heroImage: {
    width: '100%',
    height: 260,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.light.text,
    flex: 1,
    marginRight: 12,
  },
  description: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginTop: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  metaCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brand.sage,
    marginTop: 7,
  },
  ingredientText: {
    fontSize: 15,
    color: Colors.light.text,
    flex: 1,
    lineHeight: 22,
  },
  ingredientQty: {
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.sage,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: Colors.brand.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 22,
  },
  stepDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  durationText: {
    fontSize: 13,
    color: Colors.brand.sageDark,
    fontWeight: '500',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.brand.cream,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  tipText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    backgroundColor: Colors.brand.cream,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  cookButton: {
    flexDirection: 'row',
    backgroundColor: Colors.brand.sage,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  cookButtonIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: Colors.brand.cream,
  },
  cookButtonText: {
    color: Colors.brand.cream,
    fontSize: 18,
    fontWeight: '700',
  },
  shoppingButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.brand.cream,
    marginTop: 8,
  },
  shoppingButtonDisabled: {
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  shoppingButtonText: {
    color: Colors.brand.sageDark,
    fontSize: 16,
    fontWeight: '600',
  },
  shoppingButtonTextDisabled: {
    color: Colors.light.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
