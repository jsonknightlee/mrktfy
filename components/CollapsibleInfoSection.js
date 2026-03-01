import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CollapsibleInfoSection({ title, icon, data, children }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse JSON string if needed
  let parsedData = data;
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
      console.log(`📋 CollapsibleInfoSection (${title}): Parsed JSON string`);
    } catch (e) {
      console.error(`📋 CollapsibleInfoSection (${title}): Failed to parse JSON string:`, e);
      return null;
    }
  }

  // Convert object to array format if needed
  let dataArray = parsedData;
  if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
    dataArray = Object.entries(parsedData).map(([key, value]) => ({
      label: key,
      value: value
    }));
    console.log(`📋 CollapsibleInfoSection (${title}): Converted object to array format`);
  }

  // Debug logging
  console.log(`📋 CollapsibleInfoSection (${title}):`, {
    originalData: data,
    parsedData: parsedData,
    dataArray: dataArray,
    isArray: Array.isArray(dataArray),
    length: dataArray?.length,
    firstItem: dataArray?.[0]
  });

  // Don't render if data is empty, undefined, or not an array
  if (!dataArray) {
    console.log(`❌ CollapsibleInfoSection (${title}): Not rendering - data is null/undefined`);
    return null;
  }
  
  if (!Array.isArray(dataArray)) {
    console.log(`❌ CollapsibleInfoSection (${title}): Not rendering - data is not an array, type:`, typeof dataArray);
    return null;
  }
  
  if (dataArray.length === 0) {
    console.log(`❌ CollapsibleInfoSection (${title}): Not rendering - empty array`);
    return null;
  }

  console.log(`✅ CollapsibleInfoSection (${title}): Rendering with`, dataArray.length, 'items');

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <Ionicons name={icon} size={20} color="#007AFF" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.count}>({dataArray.length})</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#666"
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.content}>
          {children || (
            <ScrollView showsVerticalScrollIndicator={false}>
              {dataArray.map((item, index) => (
                <View key={index} style={styles.item}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemValue}>{item.value}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  content: {
    padding: 16,
    maxHeight: 300,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 16,
  },
  itemValue: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
