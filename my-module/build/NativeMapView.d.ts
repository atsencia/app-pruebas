import * as React from 'react';
import { ViewProps } from 'react-native';
export interface NativeMapViewProps extends ViewProps {
    initialLocation?: {
        lat: number;
        lng: number;
    };
    onOsmLocationSelected?: (event: {
        nativeEvent: {
            lat: number;
            lng: number;
        };
    }) => void;
}
export declare function NativeMapView(props: NativeMapViewProps): React.JSX.Element;
//# sourceMappingURL=NativeMapView.d.ts.map