import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib

# 1. LOAD YOUR DATA
df = pd.read_csv('yarn_data.csv')
df['ratio'] = df['swatchm'] / df['swatchsts']

# 2. DATA AUGMENTATION (Adding the "Edges")
# We add tiny projects and massive ones so the model learns the full range.
extra_data = pd.DataFrame({
    'craft_type': [1, 0, 1, 0],
    'ysize': [3, 4, 3, 4],
    'tsize': [4.5, 5.0, 4.5, 5.0],
    'ratio': [0.1, 0.1, 0.01, 0.01],
    'psts': [100, 300, 50000, 60000], # Tiny to Massive
    'actual': [10, 30, 500, 600]     # Correct linear results
})

full_df = pd.concat([df[['craft_type', 'ysize', 'tsize', 'ratio', 'psts', 'actual']], extra_data])

# 3. TRAIN THE "COMPLETE BRAIN"
X = full_df[['craft_type', 'ysize', 'tsize', 'ratio', 'psts']]
y = full_df['actual']

# n_estimators=200 makes the forest even more stable
model = RandomForestRegressor(n_estimators=200, random_state=42)
model.fit(X, y)


# 4. EXPORT
joblib.dump(model, 'yarn_model.pkl')
print(f"--- MODEL REBUILT ---")
print(f"Training Accuracy: {model.score(X, y)*100:.2f}%")