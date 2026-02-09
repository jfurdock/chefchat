import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

interface MenuRecipeCardProps {
  recipeId: string;
  recipeTitle: string;
  recipeImageUrl: string;
  checkedCount: number;
  totalCount: number;
  onStartCooking: () => void;
  onRemove: () => void;
}

export const MenuRecipeCard: React.FC<MenuRecipeCardProps> = ({
  recipeId,
  recipeTitle,
  recipeImageUrl,
  checkedCount,
  totalCount,
  onStartCooking,
  onRemove,
}) => {
  const isReadyToCook = checkedCount === totalCount && totalCount > 0;
  const progressPercentage = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;
  const chefHatIcon = require('../../assets/images/chefhat-icon.png');

  return (
    <View style={styles.container}>
      {/* Recipe Image */}
      <Image
        source={{ uri: recipeImageUrl }}
        style={styles.image}
      />

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {recipeTitle}
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
        </View>

        {/* Progress Text and Badge Row */}
        <View style={styles.bottomRow}>
          <Text style={styles.progressText}>
            {checkedCount} of {totalCount} gathered
          </Text>
          {isReadyToCook && (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={Colors.brand.sageDark}
            />
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.iconButton, styles.cookButton]}
          onPress={onStartCooking}
          activeOpacity={0.7}
        >
          <Image source={chefHatIcon} style={styles.cookIconImage} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, styles.removeButton]}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={Colors.light.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.brand.sage,
    borderRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flexShrink: 1,
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cookButton: {
    backgroundColor: Colors.brand.sage,
  },
  cookIconImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: Colors.light.card,
  },
  removeButton: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
});
