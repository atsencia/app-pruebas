import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

const NativeView = requireNativeViewManager('NativeMap');

export interface NativeMapViewProps extends ViewProps {}

export function NativeMapView(props: NativeMapViewProps) {
  return <NativeView {...props} />;
}