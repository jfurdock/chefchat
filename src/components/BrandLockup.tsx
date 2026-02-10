import { Image, StyleSheet, View } from 'react-native';

type BrandLockupProps = {
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_MAP = {
  sm: { width: 120, height: 80 },
  md: { width: 170, height: 114 },
  lg: { width: 240, height: 160 },
} as const;

export default function BrandLockup({ size = 'md' }: BrandLockupProps) {
  const scale = SIZE_MAP[size];

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/chef_chat_logo.png')}
        style={{ width: scale.width, height: scale.height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
