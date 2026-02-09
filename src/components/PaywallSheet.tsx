import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import {
  hasProEntitlement,
  purchaseProPackage,
  restorePurchases,
} from '@/src/services/subscriptionService';
import { useAuthStore } from '@/src/stores/authStore';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';

type PaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
};

const FEATURES = [
  { icon: 'mic-outline' as const, text: 'Hands-free voice cooking' },
  { icon: 'swap-horizontal-outline' as const, text: 'Smart ingredient substitutions' },
  { icon: 'footsteps-outline' as const, text: 'Step-by-step voice guidance' },
];

const chefHatIcon = require('@/assets/images/chefhat-icon.png');

export default function PaywallSheet({ visible, onClose, onSubscribed }: PaywallSheetProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const uid = useAuthStore((s) => s.user?.uid);
  const hydrate = useSubscriptionStore((s) => s.hydrate);

  const handlePurchase = async () => {
    if (!uid) {
      Alert.alert('Sign In Required', 'Please sign in before starting your free trial.');
      return;
    }
    setPurchasing(true);
    try {
      const info = await purchaseProPackage();
      if (hasProEntitlement(info)) {
        await hydrate(uid);
        onSubscribed?.();
        onClose();
      } else {
        Alert.alert(
          'Purchase Incomplete',
          'The purchase did not activate your Pro entitlement yet. Please try restoring purchases.',
        );
      }
    } catch (error: any) {
      if (error?.userCancelled) {
        return;
      }
      Alert.alert('Purchase Failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!uid) {
      Alert.alert('Sign In Required', 'Please sign in before restoring purchases.');
      return;
    }
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (hasProEntitlement(info)) {
        await hydrate(uid);
        Alert.alert('Restored!', 'Your subscription has been restored.');
        onSubscribed?.();
        onClose();
      } else {
        Alert.alert(
          'No Subscription Found',
          'We could not find an active subscription to restore.',
        );
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message ?? 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Image source={chefHatIcon} style={styles.icon} />
          <Text style={styles.headline}>Unlock Voice Cooking</Text>
          <Text style={styles.subhead}>
            Let ChefChat guide you through every recipe, hands-free.
          </Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Ionicons name={f.icon} size={22} color={Colors.brand.sage} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.price}>$2.99/month after 7-day free trial</Text>

          <TouchableOpacity
            style={styles.purchaseButton}
            activeOpacity={0.8}
            onPress={() => void handlePurchase()}
            disabled={purchasing || restoring}
          >
            {purchasing ? (
              <ActivityIndicator color={Colors.brand.cream} />
            ) : (
              <Text style={styles.purchaseButtonText}>Start Free Trial</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => void handleRestore()}
            disabled={purchasing || restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={Colors.light.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <View style={styles.legal}>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(
                  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
                )
              }
            >
              <Text style={styles.legalText}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}> · </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://chefchat.app/privacy')}>
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    width: 72,
    height: 72,
    marginBottom: 20,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subhead: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  features: {
    alignSelf: 'stretch',
    gap: 16,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  price: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  purchaseButton: {
    backgroundColor: Colors.brand.sage,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 16,
  },
  purchaseButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.brand.cream,
  },
  restoreButton: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: 'underline',
  },
  legal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  legalDot: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});
