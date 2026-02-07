import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getApp } from '@react-native-firebase/app';
import { useRecipes, useRecipeSearch, useFavorites } from '@/src/hooks/useRecipes';
import RecipeCard from '@/src/components/RecipeCard';
import Colors from '@/constants/Colors';
import { Recipe } from '@/src/types/recipe';

const PROTEIN_FILTERS = ['all', 'chicken', 'beef', 'pork', 'vegetarian'] as const;
type ProteinFilter = (typeof PROTEIN_FILTERS)[number];

const MEAT_KEYWORDS = ['chicken', 'beef', 'pork', 'bacon', 'ham', 'turkey', 'lamb', 'sausage', 'steak'];

function matchesProteinFilter(recipe: Recipe, filter: ProteinFilter): boolean {
  if (filter === 'all') return true;

  const ingredientsText = recipe.ingredients
    .map((ingredient) => `${ingredient.name} ${ingredient.category || ''}`.toLowerCase())
    .join(' ');

  if (filter === 'vegetarian') {
    return !MEAT_KEYWORDS.some((keyword) => ingredientsText.includes(keyword));
  }

  return ingredientsText.includes(filter);
}

export default function HomeScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedProtein, setSelectedProtein] = useState<ProteinFilter>('all');

  const { recipes, loading, error, refetch } = useRecipes();
  const { results: searchResults, search, clear } = useRecipeSearch();
  const { toggleFavorite, isFavorite } = useFavorites();
  const router = useRouter();

  const projectId = getApp().options.projectId || 'unknown-project';
  const recipesByProtein = recipes.filter((recipe) => matchesProteinFilter(recipe, selectedProtein));
  const searchResultsByProtein = searchResults.filter((recipe) =>
    matchesProteinFilter(recipe, selectedProtein)
  );
  const displayRecipes = searchText.trim() ? searchResultsByProtein : recipesByProtein;
  const hasActiveFilter = selectedProtein !== 'all' || searchText.trim().length > 0;

  const emptyTitle = loading
    ? 'Loading recipes...'
    : error
      ? 'Could not load recipes'
      : hasActiveFilter
        ? 'No recipes match your filters'
        : 'No recipes found';

  const emptySubtext = loading
    ? ''
    : error
      ? error
      : recipes.length === 0
        ? `No documents returned from "recipes" in project "${projectId}".`
        : 'Try a different protein filter or search term.';

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.trim()) {
        search(text);
      } else {
        clear();
      }
    },
    [search, clear]
  );

  const handleRecipePress = useCallback(
    (recipe: Recipe) => {
      router.push(`/(main)/recipe/${recipe.id}`);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchText}
            onChangeText={handleSearch}
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Protein filter chips */}
      <View style={styles.filterRow}>
        {PROTEIN_FILTERS.map((protein) => (
          <TouchableOpacity
            key={protein}
            style={[styles.chip, selectedProtein === protein && styles.chipActive]}
            onPress={() => setSelectedProtein(protein)}
          >
            <Text
              style={[styles.chipText, selectedProtein === protein && styles.chipTextActive]}
            >
              {protein === 'all' ? 'All' : protein.charAt(0).toUpperCase() + protein.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recipe list */}
      <FlatList
        data={displayRecipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            isFavorite={isFavorite(item.id)}
            onPress={() => handleRecipePress(item)}
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
            <Ionicons name="restaurant-outline" size={48} color={Colors.light.border} />
            <Text style={styles.emptyText}>{emptyTitle}</Text>
            {!!emptySubtext && <Text style={styles.emptySubtext}>{emptySubtext}</Text>}
          </View>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: Colors.brand.cream,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.brand.cream,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  chipActive: {
    backgroundColor: Colors.brand.sage,
  },
  chipText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.brand.cream,
  },
  list: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 18,
  },
});
