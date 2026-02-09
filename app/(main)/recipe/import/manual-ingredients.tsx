import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useImportStore } from '@/src/stores/importStore';
import { Ingredient } from '@/src/types/recipe';

const CATEGORIES = [
  'produce',
  'protein',
  'dairy',
  'pantry',
  'spice',
  'other',
] as const;

const UNITS = ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'ml', 'pinch', 'dash', 'whole'];

export default function ManualIngredientsScreen() {
  const router = useRouter();
  const ingredients = useImportStore((state) => state.ingredients);
  const addIngredient = useImportStore((state) => state.addIngredient);
  const removeIngredient = useImportStore((state) => state.removeIngredient);

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<Ingredient['category']>('other');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  const handleAddIngredient = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an ingredient name');
      return;
    }

    const quantityNum = quantity ? parseFloat(quantity) : 1;
    if (isNaN(quantityNum)) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }

    const newIngredient: Ingredient = {
      name: name.trim(),
      quantity: quantityNum,
      unit,
      isOptional: false,
      category,
    };

    addIngredient(newIngredient);

    setName('');
    setQuantity('');
    setUnit('');
    setCategory('other');
    setShowAddForm(false);
  };

  const handleNext = () => {
    if (ingredients.length === 0) {
      Alert.alert('Required', 'Please add at least one ingredient');
      return;
    }

    router.push('/(main)/recipe/import/manual-instructions');
  };

  const getCategoryLabel = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
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

  const renderIngredient = ({ item, index }: { item: Ingredient; index: number }) => {
    const quantityStr = item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2);

    return (
      <View style={styles.ingredientRow}>
        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientText}>
            {quantityStr}
            {item.unit && ' ' + item.unit} {item.name}
          </Text>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryBadgeColor(item.category) },
            ]}
          >
            <Text style={styles.categoryBadgeText}>
              {getCategoryLabel(item.category)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => removeIngredient(index)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color="#E53935" />
        </TouchableOpacity>
      </View>
    );
  };

  const isNextDisabled = ingredients.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step 2 of 3</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Ingredients</Text>
        </View>

        {!showAddForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={Colors.brand.sage} />
            <Text style={styles.addButtonText}>Add Ingredient</Text>
          </TouchableOpacity>
        )}

        {showAddForm && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Add Ingredient</Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name*</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Flour"
                placeholderTextColor={Colors.light.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.formSection, { flex: 1 }]}>
                <Text style={styles.formLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.formSection, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.formLabel}>Unit</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setUnitDropdownOpen(!unitDropdownOpen)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !unit && { color: Colors.light.textSecondary },
                    ]}
                  >
                    {unit || 'Select unit'}
                  </Text>
                  <Ionicons
                    name={unitDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.light.textSecondary}
                  />
                </TouchableOpacity>
                {unitDropdownOpen && (
                  <View style={styles.dropdown}>
                    {UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setUnit(u);
                          setUnitDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Category</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              >
                <Text style={styles.dropdownText}>
                  {getCategoryLabel(category)}
                </Text>
                <Ionicons
                  name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.light.textSecondary}
                />
              </TouchableOpacity>
              {categoryDropdownOpen && (
                <View style={styles.dropdown}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCategory(cat);
                        setCategoryDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
                        {getCategoryLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.formButtonRow}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddForm(false);
                  setName('');
                  setQuantity('');
                  setUnit('');
                  setCategory('other');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.addFormButton]}
                onPress={handleAddIngredient}
              >
                <Text style={styles.addFormButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {ingredients.length > 0 && (
          <View style={styles.ingredientsListContainer}>
            <Text style={styles.listTitle}>
              {ingredients.length} {ingredients.length === 1 ? 'ingredient' : 'ingredients'}
            </Text>
            <FlatList
              scrollEnabled={false}
              data={ingredients}
              renderItem={renderIngredient}
              keyExtractor={(_, index) => `ingredient-${index}`}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        )}

        {ingredients.length > 0 && (
          <TouchableOpacity
            style={[styles.nextButton, isNextDisabled && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={isNextDisabled}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        )}
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
  },
  addButton: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.brand.sage,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.sage,
  },
  formContainer: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.brand.cream,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  dropdownTrigger: {
    backgroundColor: Colors.brand.cream,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  dropdown: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  formButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.light.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  addFormButton: {
    backgroundColor: Colors.brand.sage,
  },
  addFormButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  ingredientsListContainer: {
    marginBottom: 24,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ingredientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ingredientText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  deleteButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
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
