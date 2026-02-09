import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { ShoppingItemRow } from '@/src/components/ShoppingItemRow';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { useShopping } from '@/src/hooks/useShopping';
import {
  cleanIngredientDisplayName,
  mapCategoryToStoreSection,
  sanitizeShoppingItems,
  type ShoppingItem,
} from '@/src/utils/ingredientMerger';

interface SectionData {
  title: string;
  data: ShoppingItem[];
}

export default function ShoppingScreen() {
  const router = useRouter();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const {
    menuEntries,
    shoppingItems,
    celebrationRecipeId,
    celebrationRecipeTitle,
    toggleItemAndCheckCompletion,
    dismissCelebration,
    isAllShoppingDone,
    getRecipeCompletionStatus,
    removeRecipeFromShoppingList,
  } = useShopping();

  /**
   * Organize shopping items by store section
   */
  const visibleShoppingItems = useMemo(
    () => sanitizeShoppingItems(shoppingItems),
    [shoppingItems]
  );

  /**
   * Organize shopping items by store section
   */
  const organizedSections = useMemo((): SectionData[] => {
    if (visibleShoppingItems.length === 0) {
      return [];
    }

    // Group items by section
    const sectionMap = new Map<string, ShoppingItem[]>();

    visibleShoppingItems.forEach((item) => {
      const section = mapCategoryToStoreSection(
        item.category,
        item.ingredientName || item.displayName
      );
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section)!.push(item);
    });

    // Sort items within each section: unchecked first, then checked
    const sections: SectionData[] = [];

    // Sort section names alphabetically, but put "Other" last
    const sectionNames = Array.from(sectionMap.keys()).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    sectionNames.forEach((sectionName) => {
      const items = sectionMap.get(sectionName)!;

      // Sort: unchecked items first, then checked
      items.sort((a, b) => {
        if (a.checked === b.checked) {
          return 0; // Maintain relative order
        }
        return a.checked ? 1 : -1; // Unchecked (false) comes before checked (true)
      });

      sections.push({
        title: sectionName,
        data: items,
      });
    });

    return sections;
  }, [visibleShoppingItems]);

  const allItemsChecked =
    visibleShoppingItems.length > 0 &&
    visibleShoppingItems.every((item) => item.checked);

  const recipesOnList = useMemo(
    () =>
      menuEntries.map((entry) => {
        const progress = getRecipeCompletionStatus(entry.recipeId);
        return {
          ...entry,
          checkedCount: progress.checked,
          totalCount: progress.total,
          progressPercent: progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0,
        };
      }),
    [getRecipeCompletionStatus, menuEntries, visibleShoppingItems]
  );

  const selectedRecipe = useMemo(
    () => recipesOnList.find((recipe) => recipe.recipeId === selectedRecipeId) || null,
    [recipesOnList, selectedRecipeId]
  );

  const handleStartCooking = useCallback(() => {
    if (celebrationRecipeId) {
      dismissCelebration();
      router.push(`/(main)/recipe/cook/${celebrationRecipeId}`);
    }
  }, [celebrationRecipeId, dismissCelebration, router]);

  const handleViewMenu = useCallback(() => {
    router.push('/(main)/menu');
  }, [router]);

  const handleOpenRecipeSheet = useCallback((recipeId: string) => {
    setSelectedRecipeId(recipeId);
  }, []);

  const handleCloseRecipeSheet = useCallback(() => {
    setSelectedRecipeId(null);
  }, []);

  const handleRemoveRecipe = useCallback(() => {
    if (!selectedRecipe) return;
    Alert.alert(
      'Remove Recipe',
      `Remove "${selectedRecipe.recipeTitle}" and its ingredients from this shopping list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from List',
          style: 'destructive',
          onPress: () => {
            removeRecipeFromShoppingList(selectedRecipe.recipeId);
            setSelectedRecipeId(null);
          },
        },
      ]
    );
  }, [removeRecipeFromShoppingList, selectedRecipe]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBorderAccent} />
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof shoppingItems)[0] }) => (
      <ShoppingItemRow
        id={item.id}
        displayName={cleanIngredientDisplayName(item.displayName || item.ingredientName)}
        mergedQuantity={item.mergedQuantity}
        unit={item.unit}
        preparation={item.preparation}
        checked={item.checked}
        sourceRecipeCount={item.sourceRecipes.length}
        onToggle={() => toggleItemAndCheckCompletion(item.id)}
      />
    ),
    [toggleItemAndCheckCompletion]
  );

  /**
   * Success empty state - all shopping done
   */
  const renderSuccessEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="checkmark-circle"
        size={64}
        color={Colors.brand.sageDark}
        style={{ marginBottom: 24 }}
      />
      <Text style={styles.emptyTitle}>Shopping Complete!</Text>
      <Text style={styles.emptySubtitle}>
        Head to your menu to start cooking
      </Text>
      <TouchableOpacity
        style={styles.viewMenuButton}
        onPress={handleViewMenu}
        activeOpacity={0.7}
      >
        <Text style={styles.viewMenuButtonText}>View Menu</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Regular empty state - no items
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="cart-outline"
        size={48}
        color={Colors.light.border}
        style={{ marginBottom: 16 }}
      />
      <Text style={styles.emptyTitle}>Shopping list is empty</Text>
      <Text style={styles.emptySubtitle}>
        Add recipes from the recipe detail screen
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with counts */}
      {shoppingItems.length > 0 && !allItemsChecked && (
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>
            {visibleShoppingItems.filter((item) =>
              item.sourceRecipes.some((src) => true)
            ).length === 0
              ? '0'
              : new Set(
                  visibleShoppingItems
                    .flatMap((item) => item.sourceRecipes.map((src) => src.recipeId))
                ).size}{' '}
            recipes, {visibleShoppingItems.length} items
          </Text>
        </View>
      )}

      {recipesOnList.length > 0 && !allItemsChecked && (
        <View style={styles.recipesSection}>
          <Text style={styles.recipesSectionTitle}>Recipes on this list</Text>
          {recipesOnList.map((recipe) => (
            <TouchableOpacity
              key={recipe.recipeId}
              style={styles.recipeRow}
              activeOpacity={0.7}
              onPress={() => handleOpenRecipeSheet(recipe.recipeId)}
            >
              <View style={styles.recipeRowContent}>
                <Text style={styles.recipeRowTitle} numberOfLines={1}>
                  {recipe.recipeTitle}
                </Text>
                <Text style={styles.recipeRowProgressText}>
                  {recipe.checkedCount} of {recipe.totalCount} gathered
                </Text>
                <View style={styles.recipeRowProgressTrack}>
                  <View
                    style={[
                      styles.recipeRowProgressFill,
                      { width: `${recipe.progressPercent}%` },
                    ]}
                  />
                </View>
              </View>
              <Ionicons name="chevron-up-outline" size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* List or empty state */}
      {allItemsChecked && visibleShoppingItems.length > 0 ? (
        renderSuccessEmptyState()
      ) : visibleShoppingItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <SectionList
          sections={organizedSections}
          keyExtractor={(item, index) => item.id + index}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}

      {/* Done Shopping button - shown when items exist and all checked */}
      {visibleShoppingItems.length > 0 && allItemsChecked && !celebrationRecipeId && (
        <TouchableOpacity
          style={styles.doneShoppingButton}
          activeOpacity={0.7}
        >
          <Text style={styles.doneShoppingButtonText}>Done Shopping</Text>
        </TouchableOpacity>
      )}

      {/* Celebration modal */}
      <CelebrationModal
        visible={!!celebrationRecipeId}
        recipeTitle={celebrationRecipeTitle || ''}
        onDismiss={dismissCelebration}
        onStartCooking={handleStartCooking}
      />

      <Modal
        visible={!!selectedRecipe}
        transparent
        animationType="slide"
        onRequestClose={handleCloseRecipeSheet}
      >
        <Pressable style={styles.bottomSheetBackdrop} onPress={handleCloseRecipeSheet} />
        <View style={styles.bottomSheetContainer}>
          <View style={styles.bottomSheetHandle} />

          {selectedRecipe && (
            <>
              <Text style={styles.bottomSheetTitle} numberOfLines={2}>
                {selectedRecipe.recipeTitle}
              </Text>

              {selectedRecipe.recipeImageUrl ? (
                <Image source={{ uri: selectedRecipe.recipeImageUrl }} style={styles.bottomSheetImage} />
              ) : null}

              <Text style={styles.bottomSheetProgressText}>
                {selectedRecipe.checkedCount} of {selectedRecipe.totalCount} gathered
              </Text>
              <View style={styles.bottomSheetProgressTrack}>
                <View
                  style={[
                    styles.bottomSheetProgressFill,
                    { width: `${selectedRecipe.progressPercent}%` },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={styles.removeRecipeButton}
                activeOpacity={0.8}
                onPress={handleRemoveRecipe}
              >
                <Text style={styles.removeRecipeButtonText}>Remove from List</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeSheetButton}
                activeOpacity={0.8}
                onPress={handleCloseRecipeSheet}
              >
                <Text style={styles.closeSheetButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  recipesSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 4,
  },
  recipesSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  recipeRowContent: {
    flex: 1,
  },
  recipeRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  recipeRowProgressText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  recipeRowProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    overflow: 'hidden',
  },
  recipeRowProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.brand.sage,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.brand.cream,
  },
  sectionBorderAccent: {
    width: 4,
    height: 20,
    backgroundColor: Colors.brand.sage,
    borderRadius: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  viewMenuButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.brand.sage,
  },
  viewMenuButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.card,
  },
  doneShoppingButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.brand.sageDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneShoppingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.card,
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomSheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.light.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  bottomSheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.light.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  bottomSheetImage: {
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
  },
  bottomSheetProgressText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  bottomSheetProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
    overflow: 'hidden',
  },
  bottomSheetProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.brand.sage,
  },
  removeRecipeButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#D9544F',
    paddingVertical: 14,
    alignItems: 'center',
  },
  removeRecipeButtonText: {
    color: Colors.light.card,
    fontSize: 15,
    fontWeight: '700',
  },
  closeSheetButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.brand.cream,
  },
  closeSheetButtonText: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
