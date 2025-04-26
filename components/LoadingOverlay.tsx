import { StyleSheet, View, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { withRepeat, withSequence, withTiming, useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';
import { useEffect } from 'react';
import { ThemedText } from './ThemedText';

export function LoadingOverlay({ visible = false, message = 'Please wait...' }) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1500 }),
        -1
      );
      scale.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(1.2, { duration: 300 })),
          withTiming(1, { duration: 300 })
        ),
        -1
      );
    } else {
      rotation.value = 0;
      scale.value = 1;
    }
  }, [visible]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ]
  }));

  if (!visible) return null;

  return (
    <Modal transparent>
      <View style={styles.container}>
        <View style={styles.content}>
          <Animated.View style={iconStyle}>
            <MaterialIcons name="description" size={48} color="#654321" />
          </Animated.View>
          <ThemedText style={styles.text}>{message}</ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
  },
  text: {
    fontSize: 16,
    color: '#654321',
    textAlign: 'center',
  }
});
