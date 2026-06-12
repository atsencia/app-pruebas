import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
const NativeView = requireNativeViewManager('NativeMap');
export function NativeMapView(props) {
    return <NativeView {...props}/>;
}
//# sourceMappingURL=NativeMapView.js.map