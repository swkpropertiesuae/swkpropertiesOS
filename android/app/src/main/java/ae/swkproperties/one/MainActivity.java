package ae.swkproperties.one;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity for SWK ONE (ae.swkproperties.one)
 * Registers SwkNativePlugin for Foreground Duty Location Service, Biometric Unlock & Device Enrollment.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SwkNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
