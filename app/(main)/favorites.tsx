import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '@/src/hooks/useRecipes';
import { useImportStore } from '@/src/stores/importStore';
import RecipeCard from '@/src/components/RecipeCard';
import Colors from '@/constants/Colors';

export default function FavoritesScreen() {
  const { favorites, loading, toggleFavorite, isFavorite, refetch } = useFavorites();
  const startImport = useImportStore((s) => s.startImport);
  const router = useRouter();

  const handleImportPress = () => {
    startImport();
    router.push('/(main)/recipe/import/method');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            isFavorite={isFavorite(item.id)}
            onPress={() => router.push(`/(main)/recipe/${item.id}`)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={Colors.brand.sageDark}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={Colors.light.border} />
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Tap the heart on any recipe to save it here, or import your own recipes
            </Text>
          </View>
        }
      />

      {/* Floating Action Button for Recipe Import */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={handleImportPress}
      >
        <Ionicons name="add" size={28} color={Colors.brand.cream} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  list: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 48,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brand.sageDark,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
});
