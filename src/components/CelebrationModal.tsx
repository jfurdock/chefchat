import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

interface CelebrationModalProps {
  visible: boolean;
  recipeTitle: string;
  onDismiss: () => void;
  onStartCooking?: () => void;
}

interface ConfettiPiece {
  id: number;
  color: string;
}

const CONFETTI_COLORS = [Colors.brand.sage, Colors.brand.sageDark, '#E8A87C'];

const ConfettiPiece: React.FC<{ piece: ConfettiPiece }> = ({ piece }) => {
  const animY = useRef(new Animated.Value(0)).current;
  const animX = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  const startX = Math.random() * 320 - 160; // Random x position across screen
  const duration = 2000;

  useEffect(() => {
    Animated.parallel([
      // Fall from top to bottom
      Animated.timing(animY, {
        toValue: 600,
        duration: duration,
        useNativeDriver: true,
      }),
      // Slight horizontal drift
      Animated.timing(animX, {
        toValue: startX,
        duration: duration,
        useNativeDriver: true,
      }),
      // Rotation
      Animated.timing(animRotate, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animY, animX, animRotate, duration, startX]);

  const rotation = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: piece.color,
          transform: [
            { translateY: animY },
            { translateX: animX },
            { rotate: rotation },
          ],
        },
      ]}
    />
  );
};

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  visible,
  recipeTitle,
  onDismiss,
  onStartCooking,
}) => {
  const confettiPieces = useRef<ConfettiPiece[]>([]);

  useEffect(() => {
    if (visible) {
      // Generate 20 confetti pieces
      confettiPieces.current = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      }));
    }
  }, [visible]);

  const handleStartCooking = () => {
    onStartCooking?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        {/* Confetti layer */}
        {visible && (
          <View style={styles.confettiContainer}>
            {confettiPieces.current.map((piece) => (
              <ConfettiPiece key={piece.id} piece={piece} />
            ))}
          </View>
        )}

        {/* Modal card */}
        <View style={styles.modalCard}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="ribbon-outline"
              size={64}
              color={Colors.brand.sageDark}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>All ingredients gathered!</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {recipeTitle} is ready to cook
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Keep Shopping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartCooking}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Start Cooking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    left: '50%',
    top: -10,
  },
  modalCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.brand.sageDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.sageDark,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.brand.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.card,
  },
});
