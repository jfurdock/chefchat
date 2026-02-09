import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { MenuRecipeCard } from '@/src/components/MenuRecipeCard';
import { useShoppingStore } from '@/src/stores/shoppingStore';

export default function MenuScreen() {
  const router = useRouter();
  const { menuEntries, getRecipeCompletionStatus, removeRecipeFromShoppingList } =
    useShoppingStore();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate a refresh (local state, so no-op)
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleStartCooking = useCallback(
    (recipeId: string) => {
      router.push(`/(main)/recipe/cook/${recipeId}`);
    },
    [router]
  );

  const handleRemove = useCallback(
    (recipeId: string, recipeTitle: string) => {
      Alert.alert(
        'Remove Recipe',
        `Are you sure you want to remove "${recipeTitle}" from your menu?`,
        [
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'Remove',
            onPress: () => {
              removeRecipeFromShoppingList(recipeId);
            },
            style: 'destructive',
          },
        ]
      );
    },
    [removeRecipeFromShoppingList]
  );

  const renderRecipeCard = useCallback(
    ({ item }: { item: typeof menuEntries[0] }) => {
      const completionStatus = getRecipeCompletionStatus(item.recipeId);

      return (
        <MenuRecipeCard
          recipeId={item.recipeId}
          recipeTitle={item.recipeTitle}
          recipeImageUrl={item.recipeImageUrl}
          checkedCount={completionStatus.checked}
          totalCount={completionStatus.total}
          onStartCooking={() => handleStartCooking(item.recipeId)}
          onRemove={() => handleRemove(item.recipeId, item.recipeTitle)}
        />
      );
    },
    [getRecipeCompletionStatus, handleStartCooking, handleRemove]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="book-outline"
        size={48}
        color={Colors.light.border}
        style={{ marginBottom: 16 }}
      />
      <Text style={styles.emptyTitle}>No recipes on your menu</Text>
      <Text style={styles.emptySubtitle}>
        Browse recipes and add them to your shopping list to get started
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={menuEntries}
        renderItem={renderRecipeCard}
        keyExtractor={(item) => item.recipeId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.sage}
            colors={[Colors.brand.sage]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
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
    lineHeight: 20,
  },
});
