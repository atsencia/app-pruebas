import { NativeModule, requireNativeModule } from 'expo';

declare class NativeMapModule extends NativeModule<{}> {}

export default requireNativeModule<NativeMapModule>('NativeMap');
