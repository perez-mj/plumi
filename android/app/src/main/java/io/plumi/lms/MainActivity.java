// android/app/src/main/java/io/plumi/lms/MainActivity.java
package io.plumi.lms;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int MEDIA_PERMISSION_REQUEST_CODE = 101;
    private PermissionRequest pendingWebViewRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                boolean hasCamera = ContextCompat.checkSelfPermission(
                    MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                boolean hasAudio = ContextCompat.checkSelfPermission(
                    MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

                if (hasCamera && hasAudio) {
                    request.grant(request.getResources());
                    return;
                }

                pendingWebViewRequest = request;
                List<String> needed = new ArrayList<>();
                if (!hasCamera) needed.add(Manifest.permission.CAMERA);
                if (!hasAudio) needed.add(Manifest.permission.RECORD_AUDIO);

                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    needed.toArray(new String[0]),
                    MEDIA_PERMISSION_REQUEST_CODE);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != MEDIA_PERMISSION_REQUEST_CODE || pendingWebViewRequest == null) {
            return;
        }

        boolean allGranted = grantResults.length > 0;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            pendingWebViewRequest.grant(pendingWebViewRequest.getResources());
        } else {
            pendingWebViewRequest.deny();
        }
        pendingWebViewRequest = null;
    }
}