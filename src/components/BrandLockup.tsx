import { Image, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';

type BrandLockupProps = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
};

const SIZE_MAP = {
  sm: { icon: 44, chef: 32, chat: 32 },
  md: { icon: 64, chef: 42, chat: 42 },
  lg: { icon: 84, chef: 52, chat: 52 },
} as const;

export default function BrandLockup({ size = 'md', showWordmark = true }: BrandLockupProps) {
  const scale = SIZE_MAP[size];

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Image
          source={require('@/assets/images/chefhat-icon.png')}
          style={{ width: scale.icon, height: scale.icon }}
          resizeMode="contain"
        />
      </View>
      {showWordmark && (
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { fontSize: scale.chef, color: Colors.brand.charcoal }]}>
            Chef
          </Text>
          <Text style={[styles.wordmark, { fontSize: scale.chat, color: Colors.brand.sage }]}>
            Chat
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoArea: {
    padding: 6,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  wordmark: {
    fontFamily: 'System',
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 56,
  },
});
