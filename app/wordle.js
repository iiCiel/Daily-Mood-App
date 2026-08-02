import React, { useCallback, useMemo, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { WORDLE_ANSWERS, WORDLE_GUESSES } from '../src/constants/wordleWords';

const paperArt = require('../assets/illustrations/storybook-paper-rich.png');

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const MAX_GUESSES = 6;
const WORD_LENGTH = 5;
const VALID_WORDS = new Set([...WORDLE_ANSWERS, ...WORDLE_GUESSES].map((word) => word.toUpperCase()));

function randomWord(previous) {
  if (WORDLE_ANSWERS.length === 1) return WORDLE_ANSWERS[0].toUpperCase();
  let next = previous;
  while (next === previous) {
    next = WORDLE_ANSWERS[Math.floor(Math.random() * WORDLE_ANSWERS.length)].toUpperCase();
  }
  return next;
}

function evaluateGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill('absent');
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (result[i] === 'correct') continue;
    if (remaining[guess[i]]) {
      result[i] = 'present';
      remaining[guess[i]] -= 1;
    }
  }

  return result;
}

function bestStatus(current, next) {
  const rank = { correct: 3, present: 2, absent: 1 };
  if (!current || rank[next] > rank[current]) return next;
  return current;
}

export default function WordleScreen() {
  const C = useTheme();
  const { width, height } = useWindowDimensions();
  const [answer, setAnswer] = useState(() => randomWord());
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('Guess the word');
  const [finished, setFinished] = useState(false);
  const cellSize = Math.min(46, Math.floor((width - 78) / WORD_LENGTH));
  const keyHeight = height < 780 ? 38 : 42;

  const startNewRound = useCallback(() => {
    setAnswer((prev) => randomWord(prev));
    setGuesses([]);
    setCurrentGuess('');
    setMessage('Guess the word');
    setFinished(false);
  }, []);

  useFocusEffect(useCallback(() => {
    startNewRound();
  }, [startNewRound]));

  const keyboardStatus = useMemo(() => {
    const status = {};
    guesses.forEach((row) => {
      row.letters.split('').forEach((letter, index) => {
        status[letter] = bestStatus(status[letter], row.result[index]);
      });
    });
    return status;
  }, [guesses]);

  function submitGuess() {
    if (finished) return;
    if (currentGuess.length < WORD_LENGTH) {
      setMessage('Five letters');
      return;
    }
    if (!VALID_WORDS.has(currentGuess)) {
      setMessage('Not in word list');
      return;
    }

    const result = evaluateGuess(currentGuess, answer);
    const nextGuesses = [...guesses, { letters: currentGuess, result }];
    setGuesses(nextGuesses);
    setCurrentGuess('');

    if (currentGuess === answer) {
      setMessage('You got it');
      setFinished(true);
      return;
    }

    if (nextGuesses.length === MAX_GUESSES) {
      setMessage(`Word was ${answer}`);
      setFinished(true);
      return;
    }

    setMessage(`${MAX_GUESSES - nextGuesses.length} guesses left`);
  }

  function pressKey(key) {
    if (key === 'ENTER') {
      submitGuess();
      return;
    }
    if (key === 'BACK') {
      setCurrentGuess((guess) => guess.slice(0, -1));
      return;
    }
    if (finished || currentGuess.length >= WORD_LENGTH) return;
    setCurrentGuess((guess) => `${guess}${key}`);
  }

  function cellColors(state) {
    if (state === 'correct') return { backgroundColor: C.success, borderColor: C.success, color: C.white };
    if (state === 'present') return { backgroundColor: C.accent, borderColor: C.accent, color: C.white };
    if (state === 'absent') return { backgroundColor: C.textSecondary, borderColor: C.textSecondary, color: C.white };
    return { backgroundColor: C.card, borderColor: C.border, color: C.text };
  }

  function keyColors(key) {
    const state = keyboardStatus[key];
    if (state === 'correct') return { backgroundColor: C.success, color: C.white };
    if (state === 'present') return { backgroundColor: C.accent, color: C.white };
    if (state === 'absent') return { backgroundColor: C.textSecondary, color: C.white };
    return { backgroundColor: C.card, color: C.text };
  }

  return (
    <ImageBackground source={paperArt} style={[styles.screen, { backgroundColor: C.background }]} imageStyle={styles.paper}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.newButton, { backgroundColor: C.primary }]} onPress={startNewRound}>
            <Ionicons name="sparkles-outline" size={16} color={C.white} />
            <Text style={[styles.newButtonText, { color: C.white }]}>New word</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: C.text }]}>Wordle</Text>
          <Text style={[styles.subtitle, { color: finished ? C.primary : C.textSecondary }]}>{message}</Text>
        </View>

        <View style={styles.board}>
          {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
            const saved = guesses[rowIndex];
            const rowText = saved?.letters || (rowIndex === guesses.length ? currentGuess : '');
            return (
              <View key={`row-${rowIndex}`} style={styles.row}>
                {Array.from({ length: WORD_LENGTH }).map((__, cellIndex) => {
                  const state = saved?.result[cellIndex];
                  const colors = cellColors(state);
                  return (
                    <View
                      key={`cell-${rowIndex}-${cellIndex}`}
                      style={[
                        styles.cell,
                        {
                          width: cellSize,
                          height: cellSize,
                          borderRadius: Math.max(12, cellSize * 0.28),
                          backgroundColor: colors.backgroundColor,
                          borderColor: colors.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.cellText, { color: colors.color }]}>{rowText[cellIndex] || ''}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        <View style={styles.keyboard}>
          {KEY_ROWS.map((row, rowIndex) => (
            <View key={row} style={[styles.keyRow, rowIndex === 1 && styles.middleKeyRow]}>
              {rowIndex === 2 && (
                <TouchableOpacity style={[styles.key, styles.wideKey, { height: keyHeight, backgroundColor: C.primaryLight }]} onPress={() => pressKey('ENTER')}>
                  <Text style={[styles.keyText, styles.smallKeyText, { color: C.primary }]}>Enter</Text>
                </TouchableOpacity>
              )}
              {row.split('').map((key) => {
                const colors = keyColors(key);
                return (
                  <TouchableOpacity key={key} style={[styles.key, { height: keyHeight, backgroundColor: colors.backgroundColor }]} onPress={() => pressKey(key)}>
                    <Text style={[styles.keyText, { color: colors.color }]}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
              {rowIndex === 2 && (
                <TouchableOpacity style={[styles.key, styles.wideKey, { height: keyHeight, backgroundColor: C.primaryLight }]} onPress={() => pressKey('BACK')}>
                  <Ionicons name="backspace-outline" size={18} color={C.primary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  paper: { resizeMode: 'cover', opacity: 0.96 },
  content: { flexGrow: 1, paddingTop: 50, paddingHorizontal: 18, paddingBottom: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  newButton: { minHeight: 40, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  newButtonText: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900' },
  titleBlock: { alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: 'Story', fontSize: 48, lineHeight: 52 },
  subtitle: { fontFamily: 'Rounded', fontSize: 14, fontWeight: '900', marginTop: 2 },
  board: { alignItems: 'center', gap: 6, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 6 },
  cell: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: 'Rounded', fontSize: 22, fontWeight: '900' },
  keyboard: { gap: 7 },
  keyRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  middleKeyRow: { paddingHorizontal: 14 },
  key: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  wideKey: { flex: 1.6 },
  keyText: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900' },
  smallKeyText: { fontSize: 10 },
});
