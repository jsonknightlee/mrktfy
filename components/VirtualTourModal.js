import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const { height, width } = Dimensions.get('window');

export default function VirtualTourModal({ visible, onClose, url, title }) {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  const handleLoadStart = () => setLoading(true);
  const handleLoadEnd = () => setLoading(false);

  const handleMessage = (event) => {
    const message = String(event?.nativeEvent?.data || '').trim();

    if (message === 'close-modal') {
      onClose?.();
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    const requestUrl = String(request?.url || '');
    const lowerUrl = requestUrl.toLowerCase();

    if (
      lowerUrl.startsWith('mailto:') ||
      lowerUrl.startsWith('tel:') ||
      lowerUrl.startsWith('sms:') ||
      lowerUrl.includes('email-agent') ||
      lowerUrl.includes('contact-agent') ||
      lowerUrl.includes('enquire') ||
      lowerUrl.includes('close')
    ) {
      onClose?.();
      return false;
    }

    return true;
  };

  const injectedJavaScript = `
    // Hide unnecessary UI elements for better viewing experience
    (function() {
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const nav = document.querySelector('nav');
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (nav) nav.style.display = 'none';
      
      // Try to focus on the virtual tour content
      const virtualTourElement = document.querySelector('[data-tab="virtual_tours"], .virtual-tour, .tour-container');
      if (virtualTourElement) {
        virtualTourElement.scrollIntoView();
      }

      const shouldCloseFromElement = (element) => {
        if (!element) return false;

        const href = String(element.getAttribute?.('href') || element.href || '').toLowerCase();
        const text = String(element.textContent || element.innerText || '').toLowerCase().trim();
        const ariaLabel = String(element.getAttribute?.('aria-label') || '').toLowerCase();
        const title = String(element.getAttribute?.('title') || '').toLowerCase();

        return (
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('sms:') ||
          href.includes('email-agent') ||
          href.includes('contact-agent') ||
          href.includes('enquire') ||
          text === 'close' ||
          text === 'x' ||
          text.includes('email agent') ||
          text.includes('contact agent') ||
          text.includes('enquire') ||
          ariaLabel.includes('close') ||
          ariaLabel.includes('email agent') ||
          ariaLabel.includes('contact agent') ||
          title.includes('close') ||
          title.includes('email agent') ||
          title.includes('contact agent')
        );
      };

      document.addEventListener('click', function(event) {
        const target = event.target?.closest?.('a, button, [role="button"]') || event.target;
        if (shouldCloseFromElement(target)) {
          event.preventDefault();
          event.stopPropagation();
          window.ReactNativeWebView?.postMessage('close-modal');
        }
      }, true);
    })();
    true;
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{String(title || '')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* WebView Content */}
        <View style={styles.webViewContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading {String(title || '')}...</Text>
            </View>
          )}
          
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            style={styles.webView}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            injectedJavaScript={injectedJavaScript}
            scalesPageToFit={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            allowsFullscreenVideo={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
          />
        </View>

        {/* Footer with reload button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.reloadButton}
            onPress={() => webViewRef.current?.reload()}
          >
            <Ionicons name="refresh" size={20} color="#007AFF" />
            <Text style={styles.reloadText}>Reload</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    paddingTop: 50, // Account for status bar
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  reloadText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
