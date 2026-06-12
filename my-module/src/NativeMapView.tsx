import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

const NativeView = requireNativeViewManager('NativeMap');

export interface NativeMapViewProps extends ViewProps {
  initialLocation?: { lat: number; lng: number };
  onOsmLocationSelected?: (event: { nativeEvent: { lat: number; lng: number } }) => void;
}

export function NativeMapView(props: NativeMapViewProps) {
  return <NativeView {...props} />;
}