import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

interface ShoppingItemRowProps {
  id: string;
  displayName: string;
  mergedQuantity: number;
  unit: string;
  preparation?: string;
  checked: boolean;
  sourceRecipeCount: number;
  onToggle: () => void;
}

export const ShoppingItemRow: React.FC<ShoppingItemRowProps> = ({
  id,
  displayName,
  mergedQuantity,
  unit,
  preparation,
  checked,
  sourceRecipeCount,
  onToggle,
}) => {
  const quantityText = Number.isInteger(mergedQuantity)
    ? String(mergedQuantity)
    : mergedQuantity.toFixed(2).replace(/\.00$/, '');
  const normalizedUnit = unit?.trim().toLowerCase();
  const unitText =
    normalizedUnit && normalizedUnit !== 'item' && normalizedUnit !== 'items'
      ? ` ${normalizedUnit}`
      : '';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            checked && styles.checkboxChecked,
          ]}
        >
          {checked && (
            <Ionicons
              name="checkmark"
              size={14}
              color={Colors.light.card}
            />
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.textContainer}>
        <Text
          style={[
            styles.mainText,
            checked && styles.mainTextChecked,
          ]}
          numberOfLines={1}
        >
          {`${quantityText}${unitText} ${displayName}`.trim()}
          {preparation && (
            <Text style={styles.preparationText}>
              {' '}({preparation})
            </Text>
          )}
        </Text>

        {sourceRecipeCount > 1 && (
          <Text style={styles.recipeCountBadge}>
            {sourceRecipeCount} recipes
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'center',
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand.sageDark,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.sage,
    borderColor: Colors.brand.sage,
  },
  textContainer: {
    flex: 1,
  },
  mainText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
  },
  mainTextChecked: {
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  preparationText: {
    fontWeight: '400',
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  recipeCountBadge: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
});
