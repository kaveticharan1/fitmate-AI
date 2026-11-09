import { isValidBarcode, type PackagedProduct } from '@fitmate/food-data';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, Screen, TextField } from '../../components/ui';
import type { Meal } from '../../db/schema';
import { LabelForm, type LabelValues } from '../../features/food/LabelForm';
import { useLookupBarcode, useSaveCustomFood, type LookupResult } from '../../features/food/packaged';
import { localDate } from '../../lib/time';
import { radius } from '../../theme/tokens';

export default function ScanBarcode() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const meal = (params.meal ?? 'snack') as Meal;
  const date = params.date ?? localDate();
  const [permission, requestPermission] = useCameraPermissions();
  const lookup = useLookupBarcode();
  const save = useSaveCustomFood();
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [labelMode, setLabelMode] = useState(false);
  const locked = useRef(false);

  const openPortion = (customFoodId: string) =>
    router.replace({ pathname: '/food/custom', params: { customFoodId, meal, date } });

  const start = (barcode: string) => {
    if (locked.current) return;
    locked.current = true;
    setCode(barcode);
    setLabelMode(false);
    lookup.mutate(barcode, {
      onSuccess: (r) => {
        if (r.kind === 'saved') openPortion(r.food.id);
        if (r.kind === 'not_found' || (r.kind === 'found' && !r.product.complete)) setLabelMode(true);
      },
    });
  };

  const reset = () => {
    locked.current = false;
    setCode(null);
    setLabelMode(false);
    lookup.reset();
  };

  const saveProduct = (barcode: string | null, v: LabelValues, source: 'barcode' | 'label') =>
    save.mutate({ barcode, name: v.name, brand: v.brand || null, per100: v.per100, servingG: v.servingG, source }, { onSuccess: openPortion });

  const typedValid = isValidBarcode(typed);
  const result: LookupResult | undefined = lookup.data;
  const product: PackagedProduct | null = result?.kind === 'found' ? result.product : null;

  return (
    <Screen testID="scan">
      <Header title={t('scan.title')} />

      {code == null ? (
        <>
          {permission?.granted ? (
            <View style={{ height: 280, borderRadius: radius.lg, overflow: 'hidden' }} testID="camera">
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                onBarcodeScanned={(r) => start(r.data)}
              />
            </View>
          ) : (
            <Card testID="camera-permission">
              <AppText>{permission?.canAskAgain === false ? t('scan.cameraDenied') : t('scan.cameraWhy')}</AppText>
              {permission?.canAskAgain !== false ? <Button testID="allow-camera" label={t('scan.allowCamera')} onPress={() => requestPermission()} /> : null}
            </Card>
          )}
          <AppText variant="label" tone="secondary">
            {t('scan.hint')}
          </AppText>
          <TextField
            testID="barcode-input"
            label={t('scan.typeBarcode')}
            value={typed}
            onChangeText={(v) => setTyped(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={14}
            error={typed.length >= 8 && !typedValid ? t('scan.badBarcode') : undefined}
          />
          <Button testID="barcode-lookup" variant="secondary" label={t('scan.lookUp')} disabled={!typedValid} onPress={() => typedValid && start(typed)} />
          <Button testID="no-barcode" variant="ghost" label={t('scan.noBarcode')} onPress={() => { setCode(''); setLabelMode(true); }} />
        </>
      ) : lookup.isPending ? (
        <Card>
          <AppText>{t('scan.lookingUp', { code })}</AppText>
        </Card>
      ) : lookup.isError ? (
        <Card tone="warning" testID="lookup-error">
          <AppText>{t(`scan.errors.${(lookup.error as { kind?: string }).kind ?? 'network'}`)}</AppText>
          <Button testID="retry-lookup" variant="secondary" label={t('coach.retry')} onPress={() => { locked.current = false; start(code); }} />
          <Button testID="type-label" variant="ghost" label={t('scan.typeLabel')} onPress={() => { lookup.reset(); setLabelMode(true); }} />
        </Card>
      ) : product && product.complete && !labelMode ? (
        <Card testID="product-card">
          <AppText variant="heading">{product.name}</AppText>
          {product.brand || product.quantity ? (
            <AppText tone="secondary">{[product.brand, product.quantity].filter(Boolean).join(' · ')}</AppText>
          ) : null}
          <AppText testID="product-per100">
            {t('scan.per100', { kcal: product.per100.kcal, protein: product.per100.protein, carbs: product.per100.carbs, fat: product.per100.fat })}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('scan.checkLabel')}
          </AppText>
          <Button
            testID="save-product"
            label={t('scan.saveAndChoose')}
            loading={save.isPending}
            onPress={() =>
              saveProduct(
                product.barcode,
                {
                  name: product.name,
                  brand: product.brand ?? '',
                  per100: { kcal: product.per100.kcal!, protein: product.per100.protein!, carbs: product.per100.carbs!, fat: product.per100.fat!, fiber: product.per100.fiber ?? 0 },
                  servingG: product.servingG,
                },
                'barcode',
              )
            }
          />
          <Button testID="edit-values" variant="ghost" label={t('scan.editValues')} onPress={() => setLabelMode(true)} />
          <AppText variant="caption" tone="muted">
            {t('scan.attribution')}
          </AppText>
        </Card>
      ) : labelMode ? (
        <Card testID="label-card">
          <AppText variant="heading">{result?.kind === 'not_found' ? t('scan.notFound') : product ? t('scan.incomplete') : t('scan.fromLabel')}</AppText>
          <LabelForm
            initial={{ name: product?.name, brand: product?.brand, per100: product?.per100, servingG: product?.servingG }}
            submitLabel={t('scan.saveAndChoose')}
            loading={save.isPending}
            onSubmit={(v) => saveProduct(code || null, v, 'label')}
          />
        </Card>
      ) : null}

      {save.isError ? <Banner tone="danger" text={t('errors.generic')} /> : null}
      {code != null ? <Button testID="scan-again" variant="secondary" label={t('scan.again')} onPress={reset} /> : null}
    </Screen>
  );
}
