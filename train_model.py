from datasets import load_dataset, DatasetDict
from transformers import AutoTokenizer, AutoModelForQuestionAnswering, TrainingArguments, Trainer

# Load dataset
dataset = load_dataset("json", data_files="blood_bank_qa.json")

# Check if dataset has enough samples for splitting
if len(dataset["train"]) > 1:
    # Create train and validation splits
    dataset = dataset["train"].train_test_split(test_size=0.2)
    dataset = DatasetDict({
        'train': dataset['train'],
        'validation': dataset['test']
    })
else:
    # Use the entire dataset as training data if not enough samples
    dataset = DatasetDict({
        'train': dataset["train"],
        'validation': dataset["train"]
    })

# Load tokenizer
model_name = "deepset/roberta-base-squad2"
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Debugging: Print dataset structure
print("Dataset structure:", dataset)

# Verify dataset structure
def verify_dataset_structure(dataset):
    required_fields = ["question", "context"]
    for split in dataset.keys():
        if split not in dataset:
            raise KeyError(f"Missing dataset split '{split}'")
        for field in required_fields:
            if field not in dataset[split].features:
                raise KeyError(f"Missing required field '{field}' in dataset split '{split}'")

# Verify the dataset structure before tokenization
verify_dataset_structure(dataset)

# Tokenization function
def preprocess_data(examples):
    inputs = tokenizer(
        examples["question"],
        examples["context"],
        truncation=True,
        padding="max_length",
        max_length=512
    )
    return inputs

# Apply tokenization
tokenized_datasets = dataset.map(preprocess_data, batched=True)

# Load model
model = AutoModelForQuestionAnswering.from_pretrained(model_name)

# Training arguments
training_args = TrainingArguments(
    output_dir="./blood_bank_qa_model",
    evaluation_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    num_train_epochs=3,
    weight_decay=0.01,
    logging_dir="./logs",
)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_datasets["train"],
    eval_dataset=tokenized_datasets["validation"],
    tokenizer=tokenizer,
)

# Start Training
trainer.train()

# Save Model
model.save_pretrained("./blood_bank_qa_model")
tokenizer.save_pretrained("./blood_bank_qa_model")
