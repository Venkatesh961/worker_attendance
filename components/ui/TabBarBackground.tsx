import { View } from 'react-native';

export default function TabBarBackground() {
  return (
    <View 
      style={{
        backgroundColor: '#fff',
        borderTopColor: '#e1e4e8',
        borderTopWidth: 1,
        flex: 1,
      }}
    />
  );
}

export function useBottomTabOverflow() {
  return 0;
}
