import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PropertyTimeline({ timeline }) {
  const [expandedImages, setExpandedImages] = React.useState({});

  // Parse JSON string if needed
  let parsedTimeline = timeline;
  if (typeof timeline === 'string') {
    try {
      parsedTimeline = JSON.parse(timeline);
      console.log('🏠 PropertyTimeline: Parsed JSON string to array');
    } catch (e) {
      console.error('🏠 PropertyTimeline: Failed to parse JSON string:', e);
      return null;
    }
  }

  // Debug logging
  console.log('🏠 PropertyTimeline component received:', {
    originalTimeline: timeline,
    parsedTimeline: parsedTimeline,
    isArray: Array.isArray(parsedTimeline),
    length: parsedTimeline?.length,
    firstItem: parsedTimeline?.[0]
  });

  // Don't render if timeline is empty, undefined, or not an array
  if (!parsedTimeline) {
    console.log('❌ PropertyTimeline: Not rendering - timeline is null/undefined');
    return null;
  }
  
  if (!Array.isArray(parsedTimeline)) {
    console.log('❌ PropertyTimeline: Not rendering - timeline is not an array, type:', typeof parsedTimeline);
    return null;
  }
  
  if (parsedTimeline.length === 0) {
    console.log('❌ PropertyTimeline: Not rendering - empty array');
    return null;
  }

  console.log('✅ PropertyTimeline: Rendering with', parsedTimeline.length, 'items');

  const toggleImages = (index) => {
    setExpandedImages(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Property timeline</Text>
      
      <View style={styles.timelineContainer}>
        {parsedTimeline.map((event, index) => (
          <View key={index} style={styles.timelineItem}>
            {/* Timeline line - above */}
            {index > 0 && <View style={styles.timelineLineAbove} />}
            
            {/* Event content */}
            <View style={styles.eventContent}>
              {/* Left side - Event type and dot */}
              <View style={styles.eventType}>
                <View style={styles.timelineDot} />
                <Text style={styles.eventTypeText}>{event.type}</Text>
              </View>
              
              {/* Right side - Details */}
              <View style={styles.eventDetails}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventDate}>{event.date}</Text>
                  <Text style={styles.eventStatus}>{event.status}</Text>
                </View>
                <Text style={styles.eventPrice}>{event.price}</Text>
                
                {/* Property details if available */}
                {event.details && (
                  <View style={styles.propertyDetails}>
                    <View style={styles.propertyMeta}>
                      {event.details.bedrooms && (
                        <View style={styles.metaItem}>
                          <Ionicons name="bed" size={14} color="#666" />
                          <Text style={styles.metaText}>{event.details.bedrooms} bed</Text>
                        </View>
                      )}
                      {event.details.bathrooms && (
                        <View style={styles.metaItem}>
                          <Ionicons name="water" size={14} color="#666" />
                          <Text style={styles.metaText}>{event.details.bathrooms} bath</Text>
                        </View>
                      )}
                      {event.details.receptions && (
                        <View style={styles.metaItem}>
                          <Ionicons name="home" size={14} color="#666" />
                          <Text style={styles.metaText}>{event.details.receptions} reception</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Images */}
                    {event.details.images && event.details.images.length > 0 && (
                      <View style={styles.imageContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {event.details.images.slice(0, expandedImages[index] ? undefined : 4).map((image, imgIndex) => (
                            <Image
                              key={imgIndex}
                              source={{ uri: image.url }}
                              style={styles.timelineImage}
                              resizeMode="cover"
                            />
                          ))}
                          {!expandedImages[index] && event.details.images.length > 4 && (
                            <TouchableOpacity 
                              style={styles.moreImagesButton}
                              onPress={() => toggleImages(index)}
                            >
                              <Image
                                source={{ uri: event.details.images[4].url }}
                                style={styles.timelineImage}
                                resizeMode="cover"
                              />
                              <View style={styles.moreImagesOverlay}>
                                <Ionicons name="images" size={16} color="#fff" />
                                <Text style={styles.moreImagesText}>
                                  +{event.details.images.length - 4}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
            
            {/* Timeline line - below */}
            {index < timeline.length - 1 && <View style={styles.timelineLineBelow} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  timelineContainer: {
    flexDirection: 'column',
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 24,
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventType: {
    alignItems: 'center',
    marginRight: 16,
    width: 60,
  },
  eventTypeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    marginBottom: 4,
  },
  eventDetails: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  eventStatus: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventPrice: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  propertyDetails: {
    marginTop: 8,
  },
  propertyMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  imageContainer: {
    marginTop: 8,
  },
  timelineImage: {
    width: 60,
    height: 45,
    borderRadius: 4,
    marginRight: 8,
  },
  moreImagesButton: {
    position: 'relative',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  timelineLineAbove: {
    position: 'absolute',
    top: -12,
    left: 54,
    width: 2,
    height: 12,
    backgroundColor: '#e0e0e0',
    zIndex: -1,
  },
  timelineLineBelow: {
    position: 'absolute',
    bottom: -12,
    left: 54,
    width: 2,
    height: 12,
    backgroundColor: '#e0e0e0',
    zIndex: -1,
  },
});
