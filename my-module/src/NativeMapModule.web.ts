import { registerWebModule, NativeModule } from 'expo';

class NativeMapModule extends NativeModule<{}> {}

export default registerWebModule(NativeMapModule, 'NativeMapModule');
