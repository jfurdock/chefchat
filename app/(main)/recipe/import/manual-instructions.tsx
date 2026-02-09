import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useImportStore } from '@/src/stores/importStore';
import { Step } from '@/src/types/recipe';

export default function ManualInstructionsScreen() {
  const router = useRouter();
  const steps = useImportStore((state) => state.steps);
  const addStep = useImportStore((state) => state.addStep);
  const removeStep = useImportStore((state) => state.removeStep);

  const [showAddForm, setShowAddForm] = useState(false);
  const [instruction, setInstruction] = useState('');

  const handleAddStep = () => {
    if (!instruction.trim()) {
      Alert.alert('Required', 'Please enter an instruction');
      return;
    }

    const newStep: Step = {
      number: steps.length + 1,
      instruction: instruction.trim(),
      timerRequired: false,
    };

    addStep(newStep);
    setInstruction('');
    setShowAddForm(false);
  };

  const handleNext = () => {
    if (steps.length === 0) {
      Alert.alert('Required', 'Please add at least one instruction step');
      return;
    }

    router.push('/(main)/recipe/import/review');
  };

  const renderStep = ({ item, index }: { item: Step; index: number }) => {
    return (
      <View style={styles.stepRow}>
        <View style={styles.stepNumberCircle}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
        </View>
        <View style={styles.stepInfo}>
          <Text style={styles.stepText}>{item.instruction}</Text>
        </View>
        <TouchableOpacity
          onPress={() => removeStep(index)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color="#E53935" />
        </TouchableOpacity>
      </View>
    );
  };

  const isNextDisabled = steps.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step 3 of 3</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Instructions</Text>
        </View>

        {!showAddForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={Colors.brand.sage} />
            <Text style={styles.addButtonText}>Add Step</Text>
          </TouchableOpacity>
        )}

        {showAddForm && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Add Instruction</Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Instruction*</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe this step..."
                placeholderTextColor={Colors.light.textSecondary}
                value={instruction}
                onChangeText={setInstruction}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formButtonRow}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddForm(false);
                  setInstruction('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.addFormButton]}
                onPress={handleAddStep}
              >
                <Text style={styles.addFormButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {steps.length > 0 && (
          <View style={styles.stepsListContainer}>
            <Text style={styles.listTitle}>
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            </Text>
            <FlatList
              scrollEnabled={false}
              data={steps}
              renderItem={renderStep}
              keyExtractor={(_, index) => `step-${index}`}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        )}

        {steps.length > 0 && (
          <TouchableOpacity
            style={[styles.reviewButton, isNextDisabled && styles.reviewButtonDisabled]}
            onPress={handleNext}
            disabled={isNextDisabled}
          >
            <Text style={styles.reviewButtonText}>Review Recipe</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepIndicator: {
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.sage,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
  },
  addButton: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.brand.sage,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.sage,
  },
  formContainer: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.brand.cream,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minHeight: 90,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  formButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.light.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  addFormButton: {
    backgroundColor: Colors.brand.sage,
  },
  addFormButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  stepsListContainer: {
    marginBottom: 24,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  stepNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brand.sage,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  stepInfo: {
    flex: 1,
  },
  stepText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  deleteButton: {
    padding: 8,
    marginTop: -8,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  reviewButton: {
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  reviewButtonDisabled: {
    backgroundColor: Colors.light.textSecondary,
    opacity: 0.5,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
