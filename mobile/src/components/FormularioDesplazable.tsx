
import React from 'react';

import {
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

import {
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';

export default function FormularioDesplazable(
  props: ScrollViewProps
) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        {...props}
        keyboardShouldPersistTaps="handled"
      />
    );
  }

  return (
    <KeyboardAwareScrollView
      {...props}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}
